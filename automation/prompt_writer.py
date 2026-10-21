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
_NO_TEXT_SUFFIX = "No visible text, letters, numbers, captions, signs, logos, or watermarks."
_TEXTO_VISIVEL = re.compile(
    r"\b(text|words?|letters?|numbers?|captions?|handwriting|written|writing|inscriptions?|labels?|signage)\b",
    re.I,
)


def _garantir_sem_texto(prompt: str) -> str:
    """Mantém a trava explícita no prompt final mesmo se o modelo omiti-la na resposta."""
    prompt = prompt.strip()
    if not prompt.lower().endswith(_NO_TEXT_SUFFIX.lower()):
        prompt = f"{prompt.rstrip(' .')}. {_NO_TEXT_SUFFIX}"
    return prompt


def _tem_texto_visivel(prompt: str) -> bool:
    conteudo = prompt.removesuffix(_NO_TEXT_SUFFIX).rstrip(" .")
    return bool(_TEXTO_VISIVEL.search(conteudo))


def _fallback_sem_texto(estilo: str) -> str:
    return _garantir_sem_texto(
        f"A {estilo} cinematic still conveying this moment indirectly through a blank textured surface, symbolic "
        "objects, tense atmosphere, dramatic low light, and a character reacting with unease"
    )


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
        "never write names alone; violence and injuries are only implied (shadows, silhouettes, reactions), never "
        "shown; no blood, no gore; children are never shown hurt.\n"
        "ABSOLUTE NO-TEXT RULE: every generated picture must contain zero visible text, words, letters, numbers, "
        "captions, handwriting, signs, labels, logos or watermarks, in any language. This rule still applies when "
        "the narration explicitly mentions a written message, note, wall, book, screen or sign: do not depict the "
        "writing itself; communicate the idea with an unreadable blank surface, abstract marks, objects, atmosphere "
        "or a character's reaction. Never quote or spell the narrated phrase in the visual prompt. End EVERY prompt "
        "with exactly: No visible text, letters, numbers, captions, signs, logos, or watermarks.\n"
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
            prompts[int(num)] = _garantir_sem_texto(_ROTULO.sub("", v))

    invalidos = {i: prompts[i] for i in prompts if _tem_texto_visivel(prompts[i])}
    if invalidos:
        cenas_invalidas = "\n".join(f"{i}: {cenas[i - 1]}" for i in invalidos)
        correcao = (
            "Rewrite the image prompts for the numbered scenes below because the first version would create visible "
            "writing. Return JSON only. Show the meaning indirectly with a completely blank surface, abstract "
            "non-linguistic marks, symbolic objects, atmosphere, or a character's reaction. Do not describe text, "
            "words, letters, numbers, handwriting, writing, inscriptions, labels, signage, quotes, or readable "
            "symbols. Never quote the narration. End every prompt with exactly: " + _NO_TEXT_SUFFIX + "\n\n" +
            cenas_invalidas
        )
        try:
            rr = httpx.post(f"{OLLAMA_URL}/api/chat", timeout=timeout, json={
                "model": MODELO_IA, "stream": False, "format": "json", "keep_alive": 0,
                "options": {"temperature": 0.2, "num_ctx": 4096},
                "messages": [{"role": "user", "content": correcao}]})
            rr.raise_for_status()
            corrigidos = json.loads(rr.json()["message"]["content"])
            for k, v in corrigidos.items():
                num = re.sub(r"\D", "", str(k))
                if num and int(num) in invalidos and isinstance(v, str) and v.strip():
                    candidato = _garantir_sem_texto(_ROTULO.sub("", v))
                    if not _tem_texto_visivel(candidato):
                        prompts[int(num)] = candidato
        except Exception:
            pass
        for i in invalidos:
            if _tem_texto_visivel(prompts[i]):
                prompts[i] = _fallback_sem_texto(estilo)
    return prompts
