"""Escreve os prompts das imagens (em inglês) com a IA local, para o Diretor Visual (#04) da esteira.

Mesma estratégia do LeccorTube Simples (simples/server.py: escrever_prompts): um único pedido ao Ollama
com todas as cenas, resposta em JSON, personagens com a mesma descrição em todas as cenas, sem texto na
imagem e violência só sugerida. `keep_alive: 0` descarrega o modelo logo depois, para o ComfyUI (#05)
ter a VRAM livre.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List

import httpx

from automation.video_adapter import MODELO_IA, OLLAMA_URL

_ROTULO = re.compile(r"^\s*(prompt\s*\d*|s\d{3}|scene\s*\d*|\d+)\s*[:\-–.)]\s*", re.I)


def escrever_prompts(titulo: str, cenas: List[str], estilo: str, timeout: float = 600) -> Dict[int, str]:
    """Devolve {índice da cena (1, 2, …): prompt em inglês}. Cenas que a IA não devolveu ficam de fora;
    erro de conexão/modelo levanta exceção (o agente decide o que fazer)."""
    linhas = "\n".join(f"{i}: {t}" for i, t in enumerate(cenas, 1))
    pedido = (
        "You write prompts for an image generator. The video narration is in Brazilian Portuguese.\n"
        f'Video title: "{titulo}"\nVisual style: {estilo}\n'
        "For EACH scene below write ONE English prompt (25 to 45 words) describing a single still picture that "
        "illustrates that scene: who is in it, where, what is happening, lighting and mood.\n"
        "Rules: give recurring characters the same short physical description every time (age, hair, clothes); "
        "never write names alone; no text, letters or captions in the picture; violence and injuries are only "
        "implied (shadows, silhouettes, reactions), never shown; no blood, no gore; children are never shown hurt.\n"
        'Answer ONLY with JSON: {"1": "prompt", "2": "prompt", ...} using exactly these scene numbers.\n\n'
        f"Scenes:\n{linhas}"
    )
    r = httpx.post(f"{OLLAMA_URL}/api/chat", timeout=timeout, json={
        "model": MODELO_IA, "stream": False, "format": "json", "keep_alive": 0,
        "options": {"temperature": 0.4, "num_ctx": 8192},
        "messages": [{"role": "user", "content": pedido}]})
    r.raise_for_status()
    dados = json.loads(r.json()["message"]["content"])
    prompts: Dict[int, str] = {}
    for k, v in dados.items():
        num = re.sub(r"\D", "", str(k))  # aceita "1", "s001", "scene 1"…
        if num and isinstance(v, str) and v.strip() and 1 <= int(num) <= len(cenas):
            prompts[int(num)] = _ROTULO.sub("", v).strip()
    return prompts
