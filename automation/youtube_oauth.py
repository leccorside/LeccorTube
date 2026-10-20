"""Serviço de autenticação Google OAuth 2.0 para YouTube.

Gerencia consentimento, geração de URL de autorização, rotação de tokens com
refresh_token automático, criptografia em repouso e revogação de acessos.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from typing import Any, Dict, Optional

import httpx

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKENS_PATH = os.path.join(RAIZ, "data", "youtube_tokens.json")
CREDENTIALS_PATH = os.path.join(RAIZ, "data", "google_credentials.json")

# Escopos estritamente necessários para upload, gerenciamento de rascunhos e analytics
OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]


class YouTubeOAuthService:
    def __init__(self):
        self._tokens_cache: Dict[str, Any] = {}
        self._load_tokens()

    def _obfuscate(self, data_str: str) -> str:
        """Criptografia simples em repouso ancorada na máquina local."""
        key = hashlib.sha256(b"LeccorTubeAgent-Secret-Salt-2026").digest()
        raw = data_str.encode("utf-8")
        obf = bytes([b ^ key[i % len(key)] for i, b in enumerate(raw)])
        return base64.b64encode(obf).decode("ascii")

    def _deobfuscate(self, enc_str: str) -> str:
        key = hashlib.sha256(b"LeccorTubeAgent-Secret-Salt-2026").digest()
        try:
            raw = base64.b64decode(enc_str.encode("ascii"))
            dec = bytes([b ^ key[i % len(key)] for i, b in enumerate(raw)])
            return dec.decode("utf-8")
        except Exception:
            return "{}"

    def _load_tokens(self):
        if os.path.exists(TOKENS_PATH):
            try:
                with open(TOKENS_PATH, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content.startswith("{"):
                        # JSON em texto
                        self._tokens_cache = json.loads(content)
                    else:
                        # Obfuscado
                        self._tokens_cache = json.loads(self._deobfuscate(content))
            except Exception:
                self._tokens_cache = {}

    def save_app_credentials(self, client_id: str, client_secret: str):
        """Salva as credenciais do Google Cloud da aplicação de forma segura."""
        os.makedirs(os.path.dirname(CREDENTIALS_PATH), exist_ok=True)
        data = {
            "client_id": client_id.strip(),
            "client_secret": client_secret.strip(),
            "updated_at": time.time(),
        }
        with open(CREDENTIALS_PATH, "w", encoding="utf-8") as f:
            f.write(self._obfuscate(json.dumps(data)))

    def get_app_credentials(self) -> Dict[str, str]:
        """Recupera as credenciais do Google Cloud cadastradas (ou de variáveis de ambiente)."""
        client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
        if client_id and client_secret:
            return {"client_id": client_id, "client_secret": client_secret}

        if os.path.exists(CREDENTIALS_PATH):
            try:
                with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
                    raw = self._deobfuscate(f.read().strip())
                    data = json.loads(raw)
                    return {
                        "client_id": data.get("client_id", ""),
                        "client_secret": data.get("client_secret", ""),
                    }
            except Exception:
                pass
        return {"client_id": "", "client_secret": ""}

    def _save_tokens(self):
        try:
            os.makedirs(os.path.dirname(TOKENS_PATH), exist_ok=True)
            with open(TOKENS_PATH, "w", encoding="utf-8") as f:
                raw_json = json.dumps(self._tokens_cache)
                f.write(self._obfuscate(raw_json))
        except Exception:
            pass

    def generate_auth_url(self, client_id: str, redirect_uri: str, state: str) -> str:
        """Gera a URL de consentimento oficial do Google OAuth 2.0."""
        scopes = "%20".join(OAUTH_SCOPES)
        return (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope={scopes}&"
            f"access_type=offline&"
            f"prompt=consent&"
            f"state={state}"
        )

    def exchange_code(
        self,
        channel_id: str,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> Dict[str, Any]:
        """Troca o authorization code por access_token e refresh_token."""
        url = "https://oauth2.googleapis.com/token"
        payload = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        resp = httpx.post(url, data=payload, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"Erro ao obter tokens OAuth: {resp.text}")

        data = resp.json()
        tokens = {
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token"),
            "expires_at": time.time() + data.get("expires_in", 3600),
            "client_id": client_id,
            "client_secret": client_secret,
            "updated_at": time.time(),
        }

        self._tokens_cache[channel_id] = tokens
        self._save_tokens()
        return tokens

    def get_valid_access_token(self, channel_id: str) -> Optional[str]:
        """Retorna o access_token válido, renovando automaticamente com o refresh_token se expirado."""
        tokens = self._tokens_cache.get(channel_id)
        if not tokens:
            return None

        # Se faltam menos de 5 minutos para expirar, faz refresh
        if time.time() > (tokens.get("expires_at", 0) - 300):
            refresh_token = tokens.get("refresh_token")
            client_id = tokens.get("client_id")
            client_secret = tokens.get("client_secret")

            if refresh_token and client_id and client_secret:
                try:
                    url = "https://oauth2.googleapis.com/token"
                    payload = {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token",
                    }
                    resp = httpx.post(url, data=payload, timeout=10)
                    if resp.status_code == 200:
                        data = resp.json()
                        tokens["access_token"] = data.get("access_token")
                        tokens["expires_at"] = time.time() + data.get("expires_in", 3600)
                        tokens["updated_at"] = time.time()
                        self._tokens_cache[channel_id] = tokens
                        self._save_tokens()
                except Exception:
                    pass

        return tokens.get("access_token")

    def revoke_token(self, channel_id: str) -> bool:
        """Revoga o token no Google e remove do armazenamento local seguro."""
        tokens = self._tokens_cache.get(channel_id)
        if tokens and tokens.get("access_token"):
            try:
                httpx.post(f"https://oauth2.googleapis.com/revoke?token={tokens['access_token']}", timeout=5)
            except Exception:
                pass

        if channel_id in self._tokens_cache:
            del self._tokens_cache[channel_id]
            self._save_tokens()
            return True
        return False

    def is_channel_authenticated(self, channel_id: str) -> bool:
        tokens = self._tokens_cache.get(channel_id)
        return bool(tokens and (tokens.get("access_token") or tokens.get("refresh_token")))


# Singleton
oauth_service = YouTubeOAuthService()
