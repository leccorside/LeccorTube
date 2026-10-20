"""Testes do Publicador (#09) e do Analista (#10) sem upload real.

Isolado: os vídeos são montados só na memória (nada é gravado em data/automation.db, nenhum lote é
criado) e a cota real do YouTube é apenas lida, para provar que não muda.

Rodar: .venv\\Scripts\\python.exe automation\\test_publicador.py
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "tools", "diag"))

# Por segurança, mesmo sem gravar nada: pasta de dados temporária (o banco real nem é aberto)
from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from automation.agents import AnalyticsAgent, PublishingAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, VideoBrief, VideoItem  # noqa: E402
from automation.quota_guard import quota_guard  # noqa: E402
from automation.youtube_client import youtube_client  # noqa: E402


def _video(status="QA_PENDING"):
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    v = VideoItem(batch_id="teste-publicador", title="Teste do Publicador", brief=VideoBrief(title="Teste do Publicador"), agents=agentes)
    v.status = status
    v.artifacts["video_path"] = os.path.join(RAIZ, "nao-existe.mp4")
    return v


def _agente(v, ordem):
    return next(a for a in v.agents if a.order == ordem)


def test_publicador():
    cota_antes = quota_guard.get_status()["units_used"]

    # 1. O cliente recusa o upload: sem ID, sem link, sem cota
    pub = youtube_client.upload_and_schedule("canal", "x.mp4", "t", "d", [], None, True)
    assert pub["success"] is False and pub["error"] == "UPLOAD_NOT_IMPLEMENTED", pub
    assert pub["youtube_video_id"] is None and pub["url"] is None and pub["quota_consumed"] == 0, pub
    print("[OK] upload_and_schedule recusa: sem ID falso, sem link e sem cota")

    # 2. Modo automático: vira rascunho local, nunca "Publicado"
    v = _video()
    PublishingAgent().execute(v, channel_mode="automatic")
    assert v.status == "DRAFT_READY", v.status
    assert _agente(v, 9).status == "BLOCKED", _agente(v, 9).status
    assert v.publication.get("status") == "UPLOAD_UNAVAILABLE" and not v.publication.get("youtube_video_id"), v.publication
    assert "yt-" not in str(v.publication)
    print(f"[OK] modo automático -> {v.status}, agente #09 BLOCKED: {_agente(v, 9).message[:70]}…")

    # 3. Analista não mexe num vídeo não publicado (antes trocava para LEARNING_RECORDED)
    AnalyticsAgent().execute(v)
    assert v.status == "DRAFT_READY", v.status
    assert _agente(v, 10).status == "BLOCKED", _agente(v, 10).status
    print("[OK] Analista (#10) não roda sem publicação real e mantém DRAFT_READY")

    # 4. Modo assistido: "aguardando aprovação" sobrevive ao Analista
    v2 = _video()
    PublishingAgent().execute(v2, channel_mode="assisted")
    AnalyticsAgent().execute(v2)
    assert v2.status == "AWAITING_APPROVAL", v2.status
    print("[OK] modo assistido mantém AWAITING_APPROVAL depois do Analista")

    # 5. Nenhuma unidade de cota foi gasta
    cota_depois = quota_guard.get_status()["units_used"]
    assert cota_depois == cota_antes, (cota_antes, cota_depois)
    print(f"[OK] cota intacta ({cota_antes} -> {cota_depois} unidades, pasta de dados temporária)")

    print("\nTODOS OS TESTES DO PUBLICADOR PASSARAM")


if __name__ == "__main__":
    test_publicador()
