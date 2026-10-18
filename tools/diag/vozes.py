"""Vozes de narração do LeccorTube Simples (referências do Chatterbox Multilingual).

Cada voz é um wav curto (~10 s de fala limpa) em assets/vozes/. A voz oficial é
assets/vozes/narrador_ptbr_ref.wav (recorte do NARRACAO.wav). Uma voz nova pode vir de qualquer
áudio de alguém falando em português do Brasil: `adicionar()` escolhe sozinho o melhor trecho
(fala contínua, sem silêncio longo nem saturação) e grava como referência.

Roda no .venv do app:
    .venv\\Scripts\\python.exe tools\\diag\\vozes.py lista
    .venv\\Scripts\\python.exe tools\\diag\\vozes.py adicionar <audio> "<nome>"
"""
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PASTA = os.path.join(RAIZ, "assets", "vozes")
AMOSTRAS = os.path.join(PASTA, "_amostras")
OFICIAL = "narrador_ptbr_ref.wav"
SR = 24000
JANELA = (8.0, 12.0)  # duração do trecho de referência (s)
EXT = (".wav", ".mp3", ".ogg", ".flac", ".m4a")


def _ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def lista():
    """[{id, nome, arquivo}] — a voz oficial primeiro."""
    itens = []
    if os.path.exists(os.path.join(PASTA, OFICIAL)):
        itens.append({"id": "oficial", "nome": "Voz oficial (NARRACAO)", "arquivo": os.path.join(PASTA, OFICIAL)})
    for f in sorted(os.listdir(PASTA)) if os.path.isdir(PASTA) else []:
        if f.lower().endswith(".wav") and f != OFICIAL and not f.startswith("_"):
            itens.append({"id": "user:" + f, "nome": os.path.splitext(f)[0], "arquivo": os.path.join(PASTA, f)})
    return itens


def arquivo(voz_id):
    item = next((v for v in lista() if v["id"] == (voz_id or "oficial")), None)
    if not item:
        raise ValueError(f"Voz não encontrada: {voz_id}")
    return item["arquivo"]


def amostra_path(voz_id):
    os.makedirs(AMOSTRAS, exist_ok=True)
    return os.path.join(AMOSTRAS, re.sub(r"[^\w\-]+", "_", voz_id) + ".wav")


def _melhor_trecho(w):
    """Escolhe a janela de 8–12 s com mais fala contínua; começa e termina numa pausa."""
    q = int(SR * 0.02)
    n = len(w) // q
    db = 20 * np.log10(np.sqrt((w[: n * q].reshape(n, q) ** 2).mean(axis=1)) + 1e-9)
    fala = db > max(db.max() - 35, -50)  # relativo ao volume da gravação
    satur = (np.abs(w[: n * q].reshape(n, q)) > 0.98).any(axis=1)
    pausas = [i for i in range(1, n) if not fala[i] and fala[i - 1]] or [0]  # inícios de silêncio
    inicios = [0] + [i for i in range(1, n) if fala[i] and not fala[i - 1]]
    melhor, nota = None, -1.0
    for a in inicios:
        for b in pausas:
            dur = (b - a) * 0.02
            if not JANELA[0] <= dur <= JANELA[1]:
                continue
            trecho = fala[a:b]
            buracos, run = 0, 0
            for v in trecho:  # silêncios internos > 0,7 s pioram a referência
                run = 0 if v else run + 1
                buracos += run == 36
            s = trecho.mean() - 0.15 * buracos - 2 * satur[a:b].mean()
            if s > nota:
                melhor, nota = (a, b), s
    if not melhor:
        return None
    a, b = melhor
    return max(0, a * q - int(0.1 * SR)), min(len(w), b * q + int(0.15 * SR)), nota


def adicionar(origem, nome):
    """Cria uma voz a partir de um áudio. Devolve {id, nome, inicio, duracao}."""
    nome = re.sub(r"[^\w\- ]+", "", nome or "").strip()[:40] or "Minha voz"
    if nome.lower() in ("oficial", os.path.splitext(OFICIAL)[0]):
        nome += " 2"
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "voz.wav")
        r = subprocess.run([_ffmpeg(), "-y", "-loglevel", "error", "-i", origem, "-t", "900", "-ac", "1", "-ar", str(SR), wav],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(wav):
            raise ValueError("Não consegui ler esse arquivo como áudio.")
        w, _ = sf.read(wav, dtype="float32")
    if len(w) < JANELA[0] * SR:
        raise ValueError(f"O áudio precisa ter pelo menos {JANELA[0]:.0f} s de fala.")
    achado = _melhor_trecho(w)
    if not achado or achado[2] < 0.6:
        raise ValueError("Não achei um trecho de ~10 s com fala contínua e limpa. Envie uma gravação só de voz, "
                         "sem música de fundo e com pouca pausa.")
    a, b, _ = achado
    ref = w[a:b] / (np.abs(w[a:b]).max() + 1e-9) * 0.89  # pico em -1 dB
    os.makedirs(PASTA, exist_ok=True)
    destino, n = os.path.join(PASTA, nome + ".wav"), 2
    while os.path.exists(destino):
        destino = os.path.join(PASTA, f"{nome} ({n}).wav")
        n += 1
    sf.write(destino, ref, SR, subtype="PCM_16")
    base = os.path.basename(destino)
    return {"id": "user:" + base, "nome": os.path.splitext(base)[0], "inicio": round(a / SR, 1), "duracao": round((b - a) / SR, 1)}


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "lista":
        for v in lista():
            print(f"{v['id']:<30} {v['nome']}")
    elif len(sys.argv) == 4 and sys.argv[1] == "adicionar":
        print(adicionar(sys.argv[2], sys.argv[3]))
    else:
        print(__doc__)
