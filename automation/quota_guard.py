"""CostAndQuotaGuard — Monitoramento e proteção de cotas da YouTube Data API v3 e custos.

Controla as 10.000 unidades diárias da YouTube Data API v3, impedindo que a automação
estoure limites ou tome bloqueios por quota excedida.
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUOTA_FILE = os.path.join(RAIZ, "data", "quota_usage.json")

# Custos oficiais da YouTube Data API v3 em unidades de quota por método
API_COSTS = {
    "videos.list": 1,
    "channels.list": 1,
    "playlists.list": 1,
    "search.list": 100,
    "videos.insert": 1600,
    "playlistItems.insert": 50,
    "thumbnails.set": 50,
}

DEFAULT_DAILY_LIMIT = 10000  # Limite padrão gratuito da Google Cloud Platform
SOFT_CAP_ALERT = 8000       # Alerta de atenção


class CostAndQuotaGuard:
    def __init__(self, daily_limit: int = DEFAULT_DAILY_LIMIT, filepath: Optional[str] = None):
        self.daily_limit = daily_limit
        self.filepath = filepath or QUOTA_FILE
        self._lock = threading.Lock()
        self.state = self._load_state()

    def _today_str(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _load_state(self) -> Dict[str, Any]:
        hoje = self._today_str()
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("date") == hoje:
                        return data
            except Exception:
                pass
        return {
            "date": hoje,
            "units_used": 0,
            "daily_limit": self.daily_limit,
            "operations_count": {},
            "estimated_cost_usd": 0.0,
            "last_operation": None,
            "quota_exceeded": False,
        }

    def _save_state(self):
        try:
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2)
        except Exception:
            pass

    def check_quota(self, operation: str) -> bool:
        """Verifica se há cota suficiente para executar a operação antes de dispará-la."""
        with self._lock:
            hoje = self._today_str()
            if self.state.get("date") != hoje:
                self.state = self._load_state()

            custo = API_COSTS.get(operation, 1)
            usado = self.state.get("units_used", 0)
            return (usado + custo) <= self.daily_limit

    def consume_quota(self, operation: str, custom_units: Optional[int] = None) -> int:
        """Registra o consumo de cota de uma operação."""
        with self._lock:
            hoje = self._today_str()
            if self.state.get("date") != hoje:
                self.state = self._load_state()

            custo = custom_units if custom_units is not None else API_COSTS.get(operation, 1)
            self.state["units_used"] = self.state.get("units_used", 0) + custo
            ops = self.state.setdefault("operations_count", {})
            ops[operation] = ops.get(operation, 0) + 1

            if self.state["units_used"] >= self.daily_limit:
                self.state["quota_exceeded"] = True

            self.state["last_operation"] = {
                "operation": operation,
                "cost": custo,
                "timestamp": time.time(),
            }
            self._save_state()
            return self.state["units_used"]

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            hoje = self._today_str()
            if self.state.get("date") != hoje:
                self.state = self._load_state()

            usado = self.state.get("units_used", 0)
            pct = min(100.0, (usado / self.daily_limit) * 100) if self.daily_limit else 0
            return {
                "date": self.state["date"],
                "units_used": usado,
                "daily_limit": self.daily_limit,
                "percent_used": round(pct, 1),
                "remaining_units": max(0, self.daily_limit - usado),
                "is_soft_cap": usado >= SOFT_CAP_ALERT,
                "is_hard_cap": usado >= self.daily_limit,
                "operations_count": self.state.get("operations_count", {}),
                "last_operation": self.state.get("last_operation"),
            }


# Singleton
quota_guard = CostAndQuotaGuard()
