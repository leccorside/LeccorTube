"""Som ambiente de fundo para os vídeos do LeccorTube Simples.

- Gera (uma vez) loops sintetizados em assets/ambiente/_padrao/ (chuva, vento, tempestade, noite,
  drone sombrio, fogueira). Sons reais colocados em assets/ambiente/ (mp3, wav, ogg, flac, m4a)
  aparecem na lista junto e soam melhor que os sintetizados.
- Mixa o ambiente escolhido por baixo do áudio de um vídeo pronto, em loop, com volume e fades,
  sem recodificar a imagem.

Uso pelo terminal (no .venv do app):
    .venv\\Scripts\\python.exe tools\\diag\\ambiente.py lista
    .venv\\Scripts\\python.exe tools\\diag\\ambiente.py mixar <video.mp4> <id_do_som> <volume 0-100>
"""
import os
import re
import shutil
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PASTA = os.path.join(RAIZ, "assets", "ambiente")
PADRAO = os.path.join(PASTA, "_padrao")
SR = 44100
SEG = 40  # duração do loop
EXT = (".wav", ".mp3", ".ogg", ".flac", ".m4a")
NOMES = {"chuva": "Chuva", "vento": "Vento", "tempestade": "Tempestade", "noite": "Noite com grilos",
         "drone": "Drone sombrio", "fogueira": "Fogueira"}
RMS_DB = -20.0  # nível de partida dos loops sintetizados
LUFS_ALVO = -18.0  # loudness de todos os sons (sintetizados ao gerar; os do usuário na mixagem, com loudnorm)
# volume 100% = ambiente ~6 dB abaixo da narração (bem presente); 30% fica de fundo, ~16 dB abaixo
GANHO_MAX_DB = -6.0


def _ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _ruido(n, cor, rng):
    """Ruído branco/rosa/marrom em estéreo levemente descorrelacionado."""
    w = rng.standard_normal((n, 2))
    if cor == "rosa":  # filtro de Paul Kellet (aprox. 1/f)
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        w = signal.lfilter(b, a, w, axis=0)
    elif cor == "marrom":
        w = signal.lfilter([1], [1, -0.995], w, axis=0)
    return w / (np.abs(w).max() + 1e-9)


def _faixa(x, lo, hi):
    sos = signal.butter(4, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def _lfo(n, hz, rng, prof=0.5):
    t = np.arange(n) / SR
    fase = rng.uniform(0, 2 * np.pi)
    return (1 - prof) + prof * (0.5 + 0.5 * np.sin(2 * np.pi * hz * t + fase))[:, None]


def _loop(x):
    """Emenda o fim no começo (crossfade de 2 s) para o loop não ter corte."""
    f = 2 * SR
    rampa = np.linspace(0, 1, f)[:, None]
    x[:f] = x[:f] * rampa + x[-f:] * (1 - rampa)
    return x[:-f]


def _sintetizar(tipo, rng):
    n = (SEG + 2) * SR
    t = np.arange(n) / SR
    if tipo == "chuva":
        x = _faixa(_ruido(n, "rosa", rng), 400, 9000) * 0.6
        gotas = (rng.random((n, 2)) > 0.9993) * rng.uniform(0.2, 1, (n, 2))
        x += _faixa(signal.lfilter([1], [1, -0.97], gotas, axis=0), 1500, 8000) * 0.5
        x += _faixa(_ruido(n, "marrom", rng), 40, 300) * 0.25
    elif tipo == "vento":
        base = _ruido(n, "marrom", rng)
        x = _faixa(base, 80, 900) * _lfo(n, 0.07, rng, 0.7) + _faixa(_ruido(n, "rosa", rng), 600, 2500) * 0.15 * _lfo(n, 0.11, rng, 0.9)
    elif tipo == "tempestade":
        x = _sintetizar("chuva", rng)[: n] * 0.8 + _sintetizar("vento", rng)[: n] * 0.5
        for _ in range(3):  # trovões: rajadas graves com decaimento
            ini = rng.integers(2 * SR, n - 10 * SR)
            dur = int(rng.uniform(4, 7) * SR)
            env = np.exp(-np.linspace(0, 5, dur))[:, None] * (1 - np.exp(-np.linspace(0, 40, dur)))[:, None]
            x[ini:ini + dur] += _faixa(_ruido(dur, "marrom", rng), 25, 220) * env * 1.6
        return x
    elif tipo == "noite":
        x = _faixa(_ruido(n, "rosa", rng), 200, 3000) * 0.12
        for hz, ritmo in ((4400, 1.3), (5100, 0.9)):  # dois grilos
            pulso = (np.sin(2 * np.pi * 30 * t) > 0.3) * (np.sin(2 * np.pi * ritmo * t) > 0.6)
            canto = np.sin(2 * np.pi * hz * t) * signal.lfilter([0.02], [1, -0.98], pulso.astype(float))
            pan = rng.uniform(0.3, 0.7)
            x += np.stack([canto * pan, canto * (1 - pan)], axis=1) * 0.6
    elif tipo == "drone":
        x = np.zeros((n, 2))
        for hz, v in ((55, 0.5), (55.4, 0.4), (82.4, 0.3), (110.3, 0.12)):
            x += np.stack([np.sin(2 * np.pi * hz * t), np.sin(2 * np.pi * (hz * 1.003) * t)], axis=1) * v
        x = x * _lfo(n, 0.05, rng, 0.4) + _faixa(_ruido(n, "marrom", rng), 30, 400) * 0.3 * _lfo(n, 0.03, rng, 0.8)
    elif tipo == "fogueira":
        x = _faixa(_ruido(n, "marrom", rng), 60, 700) * 0.5
        estalos = (rng.random((n, 2)) > 0.9996) * rng.uniform(0.3, 1, (n, 2))
        x += _faixa(signal.lfilter([1], [1, -0.9], estalos, axis=0), 800, 7000) * 1.2
    else:
        raise ValueError(tipo)
    return x


def gerar_padroes():
    os.makedirs(PADRAO, exist_ok=True)
    for i, tipo in enumerate(NOMES):
        p = os.path.join(PADRAO, tipo + ".wav")
        if os.path.exists(p):
            continue
        x = _loop(_sintetizar(tipo, np.random.default_rng(100 + i)))
        x = x * (10 ** (RMS_DB / 20) / (np.sqrt((x ** 2).mean()) + 1e-9))
        x = np.tanh(x / 0.95) * 0.95  # limitador suave nos picos (trovão, estalos)
        sf.write(p, x.astype(np.float32), SR, subtype="PCM_16")
        # mesma loudness percebida (LUFS) em todos, igual ao alvo dos sons do usuário: o mesmo volume
        # soa igual em qualquer som (só o RMS igual deixava "noite" 7 LU mais alto que "drone")
        ajuste = LUFS_ALVO - _lufs(p)
        x = np.tanh(x * 10 ** (ajuste / 20) / 0.95) * 0.95
        sf.write(p, x.astype(np.float32), SR, subtype="PCM_16")


def _lufs(arquivo):
    saida = subprocess.run([_ffmpeg(), "-hide_banner", "-i", arquivo, "-af", "loudnorm=print_format=summary",
                            "-f", "null", "-"], capture_output=True, text=True, errors="replace").stderr
    return float(re.search(r"Input Integrated:\s*(-?[\d.]+)", saida)[1])


def lista():
    """[{id, nome, arquivo}] — sintetizados primeiro, depois os do usuário."""
    gerar_padroes()
    itens = [{"id": t, "nome": NOMES[t] + " (sintetizado)", "arquivo": os.path.join(PADRAO, t + ".wav")} for t in NOMES]
    if os.path.isdir(PASTA):
        for f in sorted(os.listdir(PASTA)):
            if f.lower().endswith(EXT):
                itens.append({"id": "user:" + f, "nome": os.path.splitext(f)[0], "arquivo": os.path.join(PASTA, f)})
    return itens


def info(video):
    """(duração em s, se o áudio é mono)"""
    saida = subprocess.run([_ffmpeg(), "-i", video], capture_output=True, text=True, errors="replace").stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", saida).groups()
    audio = re.search(r"Audio: [^\n]*", saida)
    return int(h) * 3600 + int(m) * 60 + float(s), bool(audio and " mono" in audio[0])


def mixar(video, som_id, volume):
    """Mistura o ambiente por baixo do áudio do vídeo (substitui o arquivo). volume: 0 a 100."""
    if not som_id or volume <= 0:
        return False
    item = next((i for i in lista() if i["id"] == som_id), None)
    if not item:
        raise ValueError(f"Som ambiente não encontrado: {som_id}")
    dur, mono = info(video)
    ganho = 10 ** ((GANHO_MAX_DB + 20 * np.log10(max(volume, 1) / 100)) / 20)
    tmp = video + ".amb.mp4"
    # sons do usuário vêm com qualquer volume: loudnorm leva ao mesmo nível médio dos sintetizados
    norm = f"loudnorm=I={LUFS_ALVO:.0f}:TP=-2:LRA=15," if som_id.startswith("user:") else ""
    filtro = (f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,{norm}volume={ganho:.4f},"
              f"afade=t=in:d=1.5,afade=t=out:st={max(0, dur - 2.5):.2f}:d=2.5[amb];"
              # a narração do app é mono: duplica o canal (a conversão padrão para estéreo baixa 3 dB)
              + ("[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[voz];" if mono else
                 "[0:a]aformat=sample_rates=48000:channel_layouts=stereo[voz];") +
              # level=0: o limitador só segura picos, sem renivelar o volume da mistura
              "[voz][amb]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[a]")
    r = subprocess.run([_ffmpeg(), "-y", "-loglevel", "error", "-i", video, "-stream_loop", "-1", "-i", item["arquivo"],
                        "-filter_complex", filtro, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
                        "-b:a", "192k", "-shortest", "-movflags", "+faststart", tmp], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg: " + r.stderr[-400:])
    shutil.move(tmp, video)
    return True


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "lista":
        for i in lista():
            print(f"{i['id']:<28} {i['nome']}")
    elif len(sys.argv) == 5 and sys.argv[1] == "mixar":
        mixar(sys.argv[2], sys.argv[3], float(sys.argv[4]))
        print("ok")
    else:
        print(__doc__)
