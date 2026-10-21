"""Busca fatos de verdade sobre a pauta na Wikipédia para o Pesquisador (#01), contexto do Roteirista (#03).

A busca direta pelo título não serve: títulos de pauta ("O Animal Imortal que Consegue Voltar a Ser Bebê") trazem
artigos sem relação. Então: (1) a IA local descreve o assunto real e a história do título, sem ver artigo nenhum, e
sugere os nomes prováveis dos artigos ("Turritopsis dohrnii"); (2) busca na Wikipédia em pt e en; (3) a IA dá nota
a todos os candidatos de uma vez (pré-filtro); (4) cada artigo aprovado é conferido sozinho, com o resumo inteiro,
contra a descrição do passo 1; (5) os resumos que passam viram o contexto, com as URLs como fonte. Sem chave,
sem custo.

O passo 4 existe porque o passo 3 sozinho aprovava artigos de outro assunto com o mesmo número ("Voo Aeroflot 513"
para a lenda do "Voo 513" que pousou com esqueletos), e o roteiro misturava a queda real com a lenda. Descrever o
assunto antes de mostrar o artigo evita que o modelo "adote" o artigo como assunto do vídeo.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import httpx

from automation.video_adapter import MODELO_IA, OLLAMA_URL

# A Wikimedia recusa (403) pedidos sem contato no User-Agent: https://w.wiki/4wJS
USER_AGENT = "LeccorTube/1.0 (https://github.com/leccorside/LeccorTube) httpx"
MAX_ARTIGOS = 3
MAX_VERIFICAR = 4  # artigos do pré-filtro conferidos um a um (~2–3 s cada com o modelo carregado)
MAX_CHARS_ARTIGO = 1500


def _ollama(pedido: str, timeout: float) -> Dict[str, Any]:
    r = httpx.post(f"{OLLAMA_URL}/api/chat", timeout=timeout, json={
        "model": MODELO_IA, "stream": False, "format": "json",
        # O Roteirista (#03) usa o modelo logo depois; o Diretor Visual (#04) o descarrega antes do ComfyUI.
        "keep_alive": "2m",
        "options": {"temperature": 0.1, "num_ctx": 8192},
        "messages": [{"role": "user", "content": pedido}]})
    r.raise_for_status()
    dados = json.loads(r.json()["message"]["content"])
    if not isinstance(dados, dict):
        raise ValueError("Ollama devolveu JSON em formato inválido.")
    return dados


def _wiki(lang: str, params: Dict[str, Any], timeout: float) -> Dict[str, Any]:
    r = httpx.get(f"https://{lang}.wikipedia.org/w/api.php", timeout=timeout, headers={"User-Agent": USER_AGENT},
                  params={"format": "json", "formatversion": 2, **params})
    r.raise_for_status()
    return r.json()


def _sugerir_buscas(titulo: str, tema: str, timeout: float) -> tuple[str, Dict[str, List[str]]]:
    dados = _ollama(
        "A YouTube video will be made about the topic below. Video titles are often clickbait and do not name the "
        "subject (e.g. 'The Bird That Never Lands' is about the common swift).\n"
        f'Video title: "{titulo}"\nTheme: "{tema}"\n'
        "1. In one English sentence, describe the real subject and the specific story or claim the title tells. Do "
        "not add facts that are not in the title.\n"
        "2. Name the Wikipedia articles that most likely describe that REAL subject (a specific species, event, "
        "place, object, person, technology or concept), not generic fields: up to 3 exact article titles in "
        "Portuguese Wikipedia and up to 3 in English Wikipedia.\n"
        'Answer ONLY with JSON: {"subject": "...", "pt": ["..."], "en": ["..."]}', timeout)
    assunto = str(dados.get("subject") or "").strip() or f"{titulo} ({tema})"
    return assunto, {lang: [str(q).strip() for q in dados.get(lang, []) if str(q).strip()][:3] for lang in ("pt", "en")}


def _candidatos(buscas: Dict[str, List[str]], timeout: float) -> List[Dict[str, str]]:
    vistos, saida = set(), []
    for lang, consultas in buscas.items():
        titulos: List[str] = []
        for q in consultas:
            for h in _wiki(lang, {"action": "query", "list": "search", "srsearch": q, "srlimit": 2}, timeout)["query"]["search"]:
                if (lang, h["title"]) not in vistos:
                    vistos.add((lang, h["title"]))
                    titulos.append(h["title"])
        if not titulos:
            continue
        paginas = _wiki(lang, {"action": "query", "prop": "extracts|info", "inprop": "url", "exintro": 1,
                               "explaintext": 1, "redirects": 1, "titles": "|".join(titulos[:20])}, timeout)
        for p in paginas["query"].get("pages", []):
            texto = re.sub(r"\s+", " ", p.get("extract", "")).strip()
            if len(texto) >= 200:  # desambiguações e esboços não trazem fatos
                saida.append({"lang": lang, "titulo": p["title"], "url": p.get("fullurl", ""), "texto": texto})
    return saida


def _filtrar(titulo: str, tema: str, candidatos: List[Dict[str, str]], timeout: float) -> List[Dict[str, str]]:
    # Nota por artigo em vez de "escolha uma lista": no teste de 21/10 a lista deixava passar artigos genéricos
    # ("Neurociência", "Lenda urbana") e outro voo de mesmo número ("Voo Aeroflot 513"), e rejeitava o "UVB-76".
    lista = "\n".join(f"{i}: [{c['lang']}] {c['titulo']} — {c['texto'][:300]}" for i, c in enumerate(candidatos, 1))
    dados = _ollama(
        "Rate how well each Wikipedia article below matches the specific subject of this video.\n"
        f'Video title: "{titulo}"\nTheme: "{tema}"\n\n'
        "Scale: 3 = the article is about exactly this subject (the same species, event, place, object, station, "
        "technology or idea the title talks about); 2 = closely related and gives useful concrete facts about it; "
        "1 = a broad field or general concept that only contains the subject (e.g. 'Neuroscience', 'Urban legend', "
        "'Economics'); 0 = a different subject, including a different event, flight, person or place that merely "
        "shares a name, number or word. An article only gets 2 or 3 if its text tells the same story as the title "
        "(e.g. for 'the plane that landed with skeletons', an article about an ordinary crash of a flight with the "
        "same number is 0).\n\n"
        f"Articles:\n{lista}\n\n"
        "For every article, first say in a few words what the article is about and what the video is about, then "
        "give the score.\n"
        'Answer ONLY with JSON: {"1": {"article_is_about": "...", "video_is_about": "...", "score": 0}, "2": {...}}',
        timeout)
    notas = []
    for k, v in dados.items():
        num = re.sub(r"\D", "", str(k))
        try:
            nota = int(v.get("score") if isinstance(v, dict) else v)
        except (TypeError, ValueError):
            continue
        if num and 1 <= int(num) <= len(candidatos) and nota >= 2:
            notas.append((nota, int(num)))
    # Nota maior primeiro; no empate, a ordem da busca (o pt vem antes do en).
    return [candidatos[n - 1] for _, n in sorted(notas, key=lambda x: (-x[0], x[1]))][:MAX_VERIFICAR]


def _confere(assunto: str, artigo: Dict[str, str], timeout: float) -> bool:
    # No teste de 21/10 (16 pares artigo × pauta conhecidos) nenhum artigo errado passou; perdeu "Brain implant" e
    # "Computador quântico" para pautas vagas, que não dizem uma história específica. Melhor sem fatos que com
    # fatos de outro assunto.
    dados = _ollama(
        f'Video subject: "{assunto}"\n\n'
        f"Wikipedia article \"{artigo['titulo']}\":\n{artigo['texto'][:MAX_CHARS_ARTIGO]}\n\n"
        "Can the facts of this article be used in that video without misleading anyone? same_subject = true if the "
        "article is about that subject (even with different words, another language or a more technical name). "
        "false if the article is about a broad field that only contains the subject, or about a different event, "
        "flight, person or place that merely shares a name or number, or if the specific story of the video is not "
        "in the article.\n"
        "Also answer story_in_article = true only if the article text itself mentions the specific story or claim "
        "of the video (not just the same name or number).\n"
        'First say what the article is about. JSON only: {"article_is_about": "...", "story_in_article": true, '
        '"same_subject": true}', timeout)
    return dados.get("same_subject") is True and dados.get("story_in_article") is True


def pesquisar_fatos(titulo: str, tema: str, timeout: float = 120) -> Dict[str, Any]:
    """Devolve {"fatos": texto para o Roteirista, "fontes": [URLs], "artigos": ["pt: Título"], "assunto", "buscas"...}.
    "fatos" vazio = nada relevante encontrado. Erro de rede/Ollama levanta exceção (o agente decide o que fazer)."""
    assunto, buscas = _sugerir_buscas(titulo, tema, timeout)
    candidatos = _candidatos(buscas, timeout)
    aprovados = _filtrar(titulo, tema, candidatos, timeout) if candidatos else []
    escolhidos = [c for c in aprovados if _confere(assunto, c, timeout)][:MAX_ARTIGOS]
    blocos = []
    for c in escolhidos:
        texto = c["texto"]
        if len(texto) > MAX_CHARS_ARTIGO:  # corta no fim de uma frase
            texto = texto[:MAX_CHARS_ARTIGO].rsplit(". ", 1)[0] + "."
        blocos.append(f"[Wikipédia ({c['lang']}): {c['titulo']}] {texto}")
    return {
        "fatos": "\n\n".join(blocos),
        "fontes": [c["url"] for c in escolhidos if c["url"]],
        "artigos": [f"{c['lang']}: {c['titulo']}" for c in escolhidos],
        "assunto": assunto,
        "buscas": buscas,
        "candidatos": len(candidatos),
        "pre_aprovados": [f"{c['lang']}: {c['titulo']}" for c in aprovados],
    }
