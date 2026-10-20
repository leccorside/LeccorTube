"""Testes do VideoGenerationAdapter: som ambiente (id do som) e keep_alive do Ollama.

Isolado: pasta de dados temporária; o som ambiente é mixado numa cópia temporária de um MP4 real
(o original não é tocado) e os pedidos ao Ollama são interceptados (não precisa do modelo instalado).

Rodar: .venv\\Scripts\\python.exe automation\\test_video_adapter.py
"""
import glob
import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "tools", "diag"))

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

import numpy as np  # noqa: E402

import ambiente  # noqa: E402
from automation import video_adapter as va  # noqa: E402


def _nivel_silencios(mp4):
    """dB médio dos trechos quase silenciosos da narração (é onde o ambiente aparece)."""
    import imageio_ffmpeg
    raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", mp4, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    q = 1600
    rms = np.sqrt((a[: len(a) // q * q].reshape(-1, q) ** 2).mean(axis=1))
    # <= (e não <): narração com silêncio digital tem 20% dos trechos em 0, e "<" deixaria a média vazia
    return float(20 * np.log10(rms[rms <= np.percentile(rms, 20)].mean() + 1e-9))


def _mp4_de_teste():
    candidatos = sorted(glob.glob(os.path.join(RAIZ, "projects", "*", "output", "final.mp4")), key=os.path.getsize)
    if not candidatos:
        sys.exit("SEM MP4: gere um vídeo pelo LeccorTube Simples antes de rodar este teste.")
    destino = os.path.join(DADOS_TESTE, "video.mp4")
    shutil.copy(candidatos[0], destino)
    return candidatos[0], destino


def test_som_ambiente():
    adapter = va.VideoGenerationAdapter()
    msgs = []
    report = lambda etapa, pct, msg: msgs.append(msg)  # noqa: E731

    original, video = _mp4_de_teste()
    antes = _nivel_silencios(video)
    ok = adapter._aplicar_som_ambiente(video, {"ambient_sound": "vento", "ambient_volume": 40}, report)
    depois = _nivel_silencios(video)
    assert ok is True, msgs
    assert depois > antes + 6, (antes, depois)
    print(f"[OK] som ambiente 'vento' aplicado pelo adaptador: silêncios {antes:.1f} dB -> {depois:.1f} dB")

    # comportamento antigo: passar o caminho do arquivo no lugar do id falhava
    arquivo = next(i["arquivo"] for i in ambiente.lista() if i["id"] == "vento")
    try:
        ambiente.mixar(video, arquivo, 40)
        raise AssertionError("passar o caminho deveria falhar")
    except ValueError:
        print("[OK] passar o caminho do arquivo (como antes) continua falhando: o id é o certo")

    # id inexistente: não aplica e avisa no progresso
    msgs.clear()
    assert adapter._aplicar_som_ambiente(video, {"ambient_sound": "nao-existe"}, report) is False
    assert any("não aplicado" in m for m in msgs), msgs
    print("[OK] id inexistente: não aplica e avisa no progresso")

    # "none" e ausente: nem tenta
    assert adapter._aplicar_som_ambiente(video, {"ambient_sound": "none"}, report) is False
    assert adapter._aplicar_som_ambiente(video, {}, report) is False
    print("[OK] sem som ambiente ('none' ou ausente): não mexe no vídeo")
    assert os.path.getsize(original) > 0 and original != video  # o original não foi usado na mixagem


def test_ollama_keep_alive():
    pedidos = []

    class Resp:
        status_code = 200

        def json(self):
            return {"response": "a dark bedroom at night, cinematic"}

    original_post = va.httpx.post
    va.httpx.post = lambda url, json=None, timeout=None: (pedidos.append((url, json)), Resp())[1]
    try:
        adapter = va.VideoGenerationAdapter()
        prompt = adapter._gerar_prompt_ollama("Um quarto escuro à noite.", "anime_dark")
        adapter._liberar_ollama()
    finally:
        va.httpx.post = original_post

    assert prompt == "a dark bedroom at night, cinematic", prompt
    gerar, liberar = pedidos[0][1], pedidos[1][1]
    assert gerar.get("keep_alive") == "2m" and "keep_alive" not in gerar.get("options", {}), gerar
    print(f"[OK] prompt: keep_alive no nível de cima ({gerar['keep_alive']}), fora de options {gerar['options']}")
    assert liberar == {"model": va.MODELO_IA, "keep_alive": 0}, liberar
    print(f"[OK] descarregar: {liberar} (pedido sem prompt tira o modelo da VRAM)")


if __name__ == "__main__":
    test_som_ambiente()
    test_ollama_keep_alive()
    print("\nTODOS OS TESTES DO ADAPTADOR PASSARAM")
