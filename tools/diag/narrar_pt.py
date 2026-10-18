"""Narra as cenas de um projeto do LeccorTube em outro idioma com o Chatterbox Multilingual.

As vozes do app (Chatterbox Turbo/Kokoro) só falam inglês. Este script gera o áudio de cada cena
no idioma pedido, com o timbre e o sotaque de uma referência (por padrão a voz oficial dos vídeos,
assets\\vozes\\narrador_ptbr_ref.wav, recortada do NARRACAO.wav do usuário), e grava em audio/raw/<cena>.wav. Depois atualiza o raw_voice da cena com o hash que o app
espera (md5 do texto, 10 caracteres): assim a etapa "voice" do app reaproveita o arquivo, só aplica o
efeito de voz, e o render usa o texto da cena (no idioma novo) nas legendas.

Rode com o servidor do LeccorTube PARADO (o script edita o project.json):
    venv_voice\\Scripts\\python.exe tools\\diag\\narrar_pt.py <pasta_do_projeto> [--lang pt] [--ref ref.wav] [--cenas s001,s002]
Depois suba o servidor e rode a etapa "voice" (ela só aplica o efeito) e as seguintes.
"""
import argparse
import hashlib
import json
import os
import sys
import time

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tools\diag -> raiz
REF_PADRAO = os.path.join(RAIZ, "assets", "vozes", "narrador_ptbr_ref.wav")


def aparar(w, sr, limiar_db=-40.0, pausa=0.7, resto=0.8, folga=0.25):
    """Corta silêncio nas pontas e o "resto" que o Chatterbox às vezes inventa depois da frase
    (um estalo ou sopro curto, < `resto` s, depois de uma pausa >= `pausa` s)."""
    q = int(sr * 0.02)
    n = len(w) // q
    if n == 0:
        return w
    rms = np.sqrt((w[: n * q].reshape(n, q) ** 2).mean(axis=1) + 1e-12)
    fala = 20 * np.log10(rms) > limiar_db
    trechos, i = [], 0  # trechos de fala contínua, em quadros de 20 ms
    while i < n:
        if fala[i]:
            j = i
            while j < n and fala[j]:
                j += 1
            trechos.append([i, j])
            i = j
        else:
            i += 1
    if not trechos:
        return w
    unidos = [trechos[0]]  # junta trechos separados por pausas curtas (respiração entre palavras)
    for a, b in trechos[1:]:
        if (a - unidos[-1][1]) * 0.02 < pausa:
            unidos[-1][1] = b
        else:
            unidos.append([a, b])
    while len(unidos) > 1 and (unidos[-1][1] - unidos[-1][0]) * 0.02 < resto:
        unidos.pop()
    ini = max(0, unidos[0][0] * q - int(0.1 * sr))
    fim = min(len(w), unidos[-1][1] * q + int(folga * sr))
    return w[ini:fim]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("--lang", default="pt")
    ap.add_argument("--ref", default=REF_PADRAO,
                    help="wav de referência do timbre/sotaque (padrão: a voz oficial; '' usa a narração crua em inglês)")
    ap.add_argument("--cenas", help="ids separados por vírgula (padrão: todas)")
    ap.add_argument("--exaggeration", type=float, default=0.5)
    ap.add_argument("--cfg", type=float, default=0.5)
    ap.add_argument("--temperature", type=float, default=0.8, help="menor = mais estável, menos travadas")
    a = ap.parse_args()
    if a.ref and not os.path.exists(a.ref):
        sys.exit(f"Referência não encontrada: {a.ref}")

    pj = os.path.join(a.projeto, "project.json")
    with open(pj, encoding="utf-8") as f:
        proj = json.load(f)
    raw_dir = os.path.join(a.projeto, "audio", "raw")
    os.makedirs(raw_dir, exist_ok=True)
    cenas = [s for s in proj["scenes"] if not a.cenas or s["id"] in a.cenas.split(",")]

    ref = a.ref
    if not ref:  # junta até ~12 s da narração crua em inglês para servir de timbre
        partes, sr = [], None
        for s in proj["scenes"]:
            p = os.path.join(raw_dir, s["id"] + ".wav")
            if os.path.exists(p):
                w, sr = sf.read(p, dtype="float32")
                partes.append(w if w.ndim == 1 else w.mean(axis=1))
            if partes and sum(len(x) for x in partes) / sr >= 12:
                break
        if not partes:
            sys.exit("Sem referência: passe --ref ou gere antes a voz em inglês pelo app.")
        ref = os.path.join(raw_dir, "_ref_timbre.wav")
        sf.write(ref, np.concatenate(partes), sr)
    print(f"referência do timbre: {ref}", flush=True)

    t0 = time.time()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    tts = ChatterboxMultilingualTTS.from_pretrained(dev)
    tts.prepare_conditionals(ref, exaggeration=a.exaggeration)
    print(f"modelo carregado em {time.time() - t0:.0f} s ({dev})", flush=True)

    voz = proj.get("voice") or "turbo:k_bm_george"
    for s in cenas:
        t1 = time.time()
        wav = tts.generate(s["text"], language_id=a.lang, exaggeration=a.exaggeration, cfg_weight=a.cfg,
                           temperature=a.temperature)
        out = os.path.join(raw_dir, s["id"] + ".wav")
        w = wav.squeeze(0).cpu().numpy()
        w_ap = aparar(w, tts.sr)
        sf.write(out, w_ap, tts.sr)
        s["raw_voice"] = [voz, 1.0, hashlib.md5(s["text"].encode("utf-8")).hexdigest()[:10]]
        s["audio"], s["duration"] = None, None  # a etapa "voice" refaz o arquivo final com o efeito
        print(f"{s['id']}: {len(w_ap) / tts.sr:.1f} s de áudio (aparado de {len(w) / tts.sr:.1f} s) em {time.time() - t1:.0f} s"
              f" | {s['text'][:70]}", flush=True)

    with open(pj, "w", encoding="utf-8") as f:
        json.dump(proj, f, ensure_ascii=False, indent=2)
    print(f"pronto: {len(cenas)} cenas em {time.time() - t0:.0f} s; project.json atualizado", flush=True)


if __name__ == "__main__":
    main()
