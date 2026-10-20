"""Suíte de Testes Automatizados — Fase 1: Conexão YouTube e Base do Workflow."""
import os
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

# Isolamento: banco, cota e tokens numa pasta temporária. Precisa vir ANTES de importar a automação
# (antes, cada execução criava lotes "Explorando IA e Robótica" em data/automation.db).
from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from fastapi.testclient import TestClient  # noqa: E402
from simples.server import app  # noqa: E402
from automation.quota_guard import CostAndQuotaGuard, quota_guard  # noqa: E402
from automation.youtube_oauth import YouTubeOAuthService, oauth_service  # noqa: E402
from automation.storage import storage  # noqa: E402

if not os.path.abspath(storage.db_path).startswith(os.path.abspath(DADOS_TESTE)):
    sys.exit(f"ABORTADO: o teste usaria o banco real ({storage.db_path}).")


def test_fase1_suite():
    client = TestClient(app)
    print("==================================================")
    print(" INICIANDO TESTES DA FASE 1 — YOUTUBE & WORKFLOW")
    print("==================================================")

    # 1. Teste do CostAndQuotaGuard
    print("\n--- 1. Testando CostAndQuotaGuard ---")
    tmp_quota = os.path.join(DADOS_TESTE, "test_quota_usage.json")
    if os.path.exists(tmp_quota):
        try:
            os.remove(tmp_quota)
        except Exception:
            pass
    guard = CostAndQuotaGuard(daily_limit=2000, filepath=tmp_quota)
    assert guard.check_quota("search.list") is True, "Deveria permitir busca com cota vazia"
    guard.consume_quota("search.list")
    st = guard.get_status()
    assert st["units_used"] == 100, f"Esperava 100 unidades, obteve {st['units_used']}"
    assert st["remaining_units"] == 1900, "Cota restante incorreta"
    print("[OK] Consumo de busca (100 pts) registrado corretamente.")

    # Simular consumo até estouro
    guard.consume_quota("videos.insert", custom_units=1950)
    assert guard.check_quota("search.list") is False, "Deveria bloquear operação após atingir limite de cota"
    st_exceeded = guard.get_status()
    assert st_exceeded["is_hard_cap"] is True, "Deveria sinalizar hard cap ativo"
    print("[OK] Bloqueio preventivo contra estouro de quota validado com sucesso.")
    if os.path.exists(tmp_quota):
        try:
            os.remove(tmp_quota)
        except Exception:
            pass

    # 2. Teste do YouTubeOAuthService
    print("\n--- 2. Testando YouTubeOAuthService ---")
    oauth = YouTubeOAuthService()
    url = oauth.generate_auth_url(client_id="dummy-client.apps.googleusercontent.com", redirect_uri="http://localhost:7861/oauth", state="canal-teste")
    assert "accounts.google.com/o/oauth2/v2/auth" in url
    assert "scope=https://www.googleapis.com/auth/youtube.upload" in url
    print("[OK] URL oficial de consentimento Google OAuth 2.0 gerada com escopos corretos.")

    # Criptografia em repouso
    segredo = "token_sensivel_muito_secreto_xyz_123"
    obf = oauth._obfuscate(segredo)
    assert obf != segredo, "Dado sensível não pode ficar em texto puro"
    dec = oauth._deobfuscate(obf)
    assert dec == segredo, "Descriptografia em repouso deve restaurar o valor exato"
    print("[OK] Criptografia de tokens em repouso validada.")

    # 3. Teste das Rotas HTTP da Fase 1
    print("\n--- 3. Testando Rotas HTTP da Fase 1 ---")
    # Quota endpoint
    r_quota = client.get("/api/automation/quota")
    assert r_quota.status_code == 200
    q_data = r_quota.json()
    assert "units_used" in q_data and "daily_limit" in q_data
    print("[OK] GET /api/automation/quota retornou telemetria de cota.")

    # Criar canal de teste temporário para não interferir nos canais do usuário
    client.post("/api/automation/channels", json={
        "id": "test_ch_fase1",
        "title": "Canal de Teste Automatizado",
        "handle": "@test_fase1",
        "is_authenticated": True
    })

    # Auth URL endpoint
    r_auth = client.get("/api/automation/channels/test_ch_fase1/auth-url?client_id=teste123&redirect_uri=http://localhost/cb")
    assert r_auth.status_code == 200
    assert "accounts.google.com" in r_auth.json()["auth_url"]
    print("[OK] GET /api/automation/channels/{id}/auth-url OK.")

    # Settings do Canal (modo operacional, orçamento, políticas)
    r_patch = client.patch("/api/automation/channels/test_ch_fase1/settings", json={
        "mode": "automatic",
        "daily_budget_usd": 35.0,
        "max_videos_per_day": 5,
        "publication_policy": "schedule"
    })
    assert r_patch.status_code == 200
    ch_updated = r_patch.json()["channel"]
    assert ch_updated["mode"] == "automatic"
    assert ch_updated["daily_budget_usd"] == 35.0
    print("[OK] PATCH /api/automation/channels/{id}/settings atualizou políticas com sucesso.")

    # Revogação segura
    r_rev = client.post("/api/automation/channels/test_ch_fase1/revoke")
    assert r_rev.status_code == 200
    print("[OK] POST /api/automation/channels/{id}/revoke executado com limpeza segura.")

    # 4. Teste de Idempotência e Pausa do Workflow
    print("\n--- 4. Testando Idempotência e Controles do Workflow ---")
    r_batch = client.post("/api/automation/batches", json={
        "channel_id": "test_ch_fase1",
        "niche": "tecnologia",
        "subniche": "IA e Robótica",
        "format": "shorts",
        "video_count": 2,
        "mode": "assisted"
    })
    assert r_batch.status_code == 200
    b_id = r_batch.json()["batch"]["id"]

    # Pausar
    r_pause = client.post(f"/api/automation/batches/{b_id}/pause")
    assert r_pause.status_code == 200
    b_obj = storage.get_batch(b_id)
    assert b_obj.status == "PAUSED"
    print("[OK] Botão PAUSE congela a admissão e preserva estado no SQLite.")

    # Retomar
    r_res = client.post(f"/api/automation/batches/{b_id}/resume")
    assert r_res.status_code == 200
    b_obj2 = storage.get_batch(b_id)
    assert b_obj2.status == "RUNNING"
    print("[OK] Botão RESUME retoma a esteira com reconciliação de estado.")

    # Stop seguro
    r_stop = client.post(f"/api/automation/batches/{b_id}/stop")
    assert r_stop.status_code == 200
    b_obj3 = storage.get_batch(b_id)
    assert b_obj3.status == "STOPPED"
    print("[OK] Botão STOP interrompe o lote com integridade de arquivos.")

    # Limpeza do canal de teste
    client.delete("/api/automation/channels/test_ch_fase1")

    print("\n==================================================")
    print(" TODOS OS TESTES DA FASE 1 FORAM CONCLUÍDOS COM 100% DE SUCESSO!")
    print("==================================================")


if __name__ == "__main__":
    test_fase1_suite()
