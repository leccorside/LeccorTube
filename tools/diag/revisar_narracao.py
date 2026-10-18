"""Revisa a narração crua de cada cena (audio/raw/<cena>.wav) com o Whisper.

1. Corta o áudio logo depois da última palavra falada (e um pouco antes da primeira), tirando o
   silêncio e as sobras que o Chatterbox às vezes inventa no fim (sopro, estalo, sílaba solta) sem
   nunca comer fala.
2. Compara o que foi ouvido com o texto da cena e lista as cenas com erro (palavras faltando,
   trocadas ou inventadas), para o narrar_pt.py refazer só essas.

Roda no .venv do app (tem o faster_whisper):
    .venv\\Scripts\\python.exe tools\\diag\\revisar_narracao.py <pasta_do_projeto> [--cenas s001,s002] [--limiar 0.85]
Saída: uma linha por cena e, no fim, "REFAZER: s003,s007" (ou "REFAZER: -"). Nas cenas cortadas, zera
`audio`/`duration` no project.json para a etapa "voice" do app refazer o arquivo final.
"""
import argparse
import difflib
import json
import os
import re

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import soundfile as sf
from faster_whisper import WhisperModel
from num2words import num2words


def normalizar(t):
    """Minúsculas, sem pontuação e com números por extenso (o Whisper escreve "2012")."""
    t = t.lower()
    t = re.sub(r"\d{1,3}(?:\.\d{3})+(?!\d)", lambda m: m[0].replace(".", ""), t)
    t = re.sub(r"\d+", lambda m: num2words(int(m[0]), lang="pt_BR").replace(",", ""), t)
    t = t.replace("-", " ")  # "jogou-o" = "jogou o"
    return re.sub(r"[^\w]+", " ", t).split()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("--cenas")
    ap.add_argument("--limiar", type=float, default=0.85, help="semelhança mínima (0 a 1) entre o falado e o texto")
    ap.add_argument("--modelo", default="small")
    a = ap.parse_args()

    pj = os.path.join(a.projeto, "project.json")
    proj = json.load(open(pj, encoding="utf-8"))
    mudou = False
    cenas = [s for s in proj["scenes"] if not a.cenas or s["id"] in a.cenas.split(",")]
    m = WhisperModel(a.modelo, device="cpu", compute_type="int8")  # a GPU fica livre para a voz e as imagens
    refazer = []
    for s in cenas:
        p = os.path.join(a.projeto, "audio", "raw", s["id"] + ".wav")
        if not os.path.exists(p):
            continue
        w, sr = sf.read(p, dtype="float32")
        mono = w if w.ndim == 1 else w.mean(axis=1)
        if sr != 16000:
            import numpy as np
            idx = np.linspace(0, len(mono) - 1, int(len(mono) * 16000 / sr))
            a16 = np.interp(idx, np.arange(len(mono)), mono).astype("float32")
        else:
            a16 = mono
        segs, _ = m.transcribe(a16, language="pt", word_timestamps=True, vad_filter=False,
                               condition_on_previous_text=False)
        palavras = [x for seg in segs for x in seg.words]
        ouvido = " ".join(x.word for x in palavras).strip()
        sim = difflib.SequenceMatcher(None, normalizar(s["text"]), normalizar(ouvido), autojunk=False).ratio()

        corte = ""
        if palavras:  # corta antes da 1ª palavra e logo depois da última
            ini = max(0.0, palavras[0].start - 0.12)
            fim = min(len(w) / sr, palavras[-1].end + 0.3)
            if ini > 0.05 or len(w) / sr - fim > 0.15:
                sf.write(p, w[int(ini * sr):int(fim * sr)], sr)
                corte = f" | cortado {len(w) / sr:.1f}s -> {fim - ini:.1f}s"
                s["audio"], s["duration"] = None, None  # a etapa "voice" do app refaz o arquivo final
                mudou = True
        ok = sim >= a.limiar
        if not ok:
            refazer.append(s["id"])
        print(f"{s['id']}: {'ok ' if ok else 'ERRO'} {sim:.2f}{corte} | ouvido: {ouvido[:90]}", flush=True)
    if mudou:  # o servidor do app lê o project.json do disco a cada pedido; rodar com o projeto parado
        with open(pj, "w", encoding="utf-8") as f:
            json.dump(proj, f, ensure_ascii=False, indent=2)
    print("REFAZER: " + (",".join(refazer) or "-"), flush=True)


if __name__ == "__main__":
    main()
