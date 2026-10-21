"""Testes de integração ponta a ponta da Esteira Autônoma LeccorTubeAgent."""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

# Isolamento: banco, cota e tokens numa pasta temporária. Precisa vir ANTES de importar a automação
# (antes, cada execução criava lotes "Explorando Computação Quântica" em data/automation.db).
from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from fastapi.testclient import TestClient  # noqa: E402
from simples.server import app  # noqa: E402
from automation.storage import storage  # noqa: E402

if not os.path.abspath(storage.db_path).startswith(os.path.abspath(DADOS_TESTE)):
    sys.exit(f"ABORTADO: o teste usaria o banco real ({storage.db_path}).")

def test_pipeline():
    client = TestClient(app)

    # 1. Página Principal
    r1 = client.get("/")
    assert r1.status_code == 200, f"Falha GET /: {r1.status_code}"
    assert "LeccorTubeAgent" in r1.text, "LeccorTubeAgent não encontrado no HTML de /"
    print("1. GET / OK (HTML LeccorTubeAgent retornado)")

    # 2. Canais
    r2 = client.get("/api/automation/channels")
    assert r2.status_code == 200, f"Falha GET /channels: {r2.status_code}"
    canais = r2.json()
    assert len(canais) > 0, "Nenhum canal retornado"
    print(f"2. GET /api/automation/channels OK ({len(canais)} canais)")

    # 3. Dashboard
    r3 = client.get("/api/automation/dashboard")
    assert r3.status_code == 200, f"Falha GET /dashboard: {r3.status_code}"
    dash = r3.json()
    assert len(dash["agents"]) == 10, f"Esperava 10 agentes, veio {len(dash['agents'])}"
    print(f"3. GET /api/automation/dashboard OK ({len(dash['agents'])} agentes presentes)")

    # 4. Iniciar Lote (START)
    r4 = client.post("/api/automation/batches", json={
        "channel_id": canais[0]["id"],
        "niche": "tecnologia",
        "subniche": "Computação Quântica",
        "format": "shorts",
        "video_count": 2,
        "narration_voice": "user:Voz de teste.wav",
        "mode": "assisted"
    })
    assert r4.status_code == 200, f"Falha POST /batches: {r4.status_code}"
    batch_id = r4.json()["batch"]["id"]
    videos = storage.list_videos_by_batch(batch_id)
    assert videos and all(v.brief.narration_voice == "user:Voz de teste.wav" for v in videos)
    print(f"4. POST /api/automation/batches OK (Batch ID: {batch_id})")

    # 5. Pausar (PAUSE)
    r5 = client.post(f"/api/automation/batches/{batch_id}/pause")
    assert r5.status_code == 200, f"Falha POST /pause: {r5.status_code}"
    print("5. POST /pause OK")

    # 6. Retomar (RESUME)
    r6 = client.post(f"/api/automation/batches/{batch_id}/resume")
    assert r6.status_code == 200, f"Falha POST /resume: {r6.status_code}"
    print("6. POST /resume OK")

    # 7. Parar (STOP)
    r7 = client.post(f"/api/automation/batches/{batch_id}/stop")
    assert r7.status_code == 200, f"Falha POST /stop: {r7.status_code}"
    print("7. POST /stop OK")

    # 8. Learning changelog
    r8 = client.get("/api/automation/learning/changelog")
    assert r8.status_code == 200
    print("8. GET /api/automation/learning/changelog OK")

    # 9. Interface manual preservada
    r9 = client.get("/simples")
    assert r9.status_code == 200
    assert "LeccorTube Simples" in r9.text
    print("9. GET /simples OK (Interface manual preservada intacta)")

    print("\nTODOS OS 9 TESTES DE INTEGRAÇÃO PASSARAM COM SUCESSO!")

if __name__ == "__main__":
    test_pipeline()
