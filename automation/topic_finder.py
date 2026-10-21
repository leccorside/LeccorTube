"""Pautas "artigo primeiro, título depois" para o Pesquisador (#01).

Antes, a pauta era um título pronto (catálogo fixo ou busca do YouTube) e depois se procuravam fatos que o
sustentassem; no lote de teste de 21/10 isso deu títulos de compilação ligados a artigos aleatórios e uma pauta
sobre o "Srpski film". Agora:
1. sorteia categorias da Wikipédia do nicho (automation/categorias_nichos.json, aprovadas pelo usuário) e junta os
   artigos delas e das subcategorias de 1º nível, sem listas ("Lista de…"), desambiguações e artigos já usados;
2. pega o resumo de até 10 candidatos (descarta os curtos) e as visualizações dos últimos 30 dias (API da
   Wikimedia, sinal de demanda grátis);
3. em ordem de visualizações, passa cada um pelo filtro de temas sensíveis (sensitive_filter) até um passar;
4. a IA local escreve o título em pt-BR só com o que está no artigo (números conferidos contra o texto).
"""
from __future__ import annotations

import datetime as dt
import json
import os
import random
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx

from automation import sensitive_filter
from automation.fact_research import USER_AGENT, _ollama, _wiki
from automation.paths import RAIZ, pasta_dados

CATEGORIAS_PATH = os.path.join(RAIZ, "automation", "categorias_nichos.json")
PREFIXO = {"pt": "Categoria:", "en": "Category:"}
_LISTA = re.compile(r"^(lista|listas|list|lists) (de|of)\b", re.I)
_CAIXA_ALTA = re.compile(r"^[^a-zà-ÿ]*$")
_FICCAO = re.compile(r"fictional|fiction|fict[ií]ci|fic[cç][aã]o|in popular culture|na cultura popular", re.I)
# Idioma do título: "Apatheia: A Virtue Beyond Indifference" passou na 1ª versão da validação
_PALAVRAS_PT = re.compile(r"\b(de|do|da|dos|das|que|o|os|as|um|uma|no|na|nos|nas|em|para|com|por|e|é|como|sobre|se|seu|sua|ao)\b", re.I)
_PALAVRAS_EN = re.compile(r"\b(the|of|and|with|beyond|your|how|why|what|is|for|to|in|its|this|that|from)\b", re.I)
CANDIDATOS = 10        # resumos buscados por pauta
MIN_CHARS = 500        # resumo mais curto que isso não sustenta um roteiro
MIN_CHARS_FATOS = 1000  # artigo inteiro: com 593 letras ("Space jellyfish") a IA encheu o roteiro com suposições
MAX_CHARS_FATOS = 3000
GENERICAS = ("você não vai acreditar", "chocante", "ninguém te contou", "ninguém sabe", "a verdade sobre",
             "o que você não sabia")


def _config(nicho: str) -> Dict[str, Any]:
    try:
        with open(CATEGORIAS_PATH, encoding="utf-8") as f:
            cfg = json.load(f).get(nicho)
    except (OSError, ValueError):
        return {}
    return cfg if isinstance(cfg, dict) else {}


def categorias(nicho: str) -> Dict[str, List[str]]:
    cfg = _config(nicho)
    return {lang: list(cfg.get(lang, [])) for lang in ("pt", "en") if cfg.get(lang)}


def combina_com_nicho(nome_nicho: str, descricao: str, art: Dict[str, Any], timeout: float) -> bool:
    """A IA descarta artigos CLARAMENTE fora do tema do canal. Categorias trazem artigos tangenciais (no teste de
    21/10 o nicho Motivação recebeu "Swimming", "Yasser Arafat" e "Pancake"), e a ordem por visualizações favorece
    esses artigos famosos. A 1ª versão ("só serve se o assunto for do tema") reprovava quase tudo em Curiosidades e
    Motivação; agora a pergunta é o contrário: só rejeita o que não tem nada a ver."""
    dados = _ollama(
        f'A YouTube channel is about "{nome_nicho}": {descricao}.\n'
        f"Article: {art['titulo']}\nSummary: {art['resumo'][:800]}\n\n"
        "Is this article CLEARLY off-topic for the channel? Off-topic examples: a food or recipe, a sport, a TV show "
        "or comic character, a politician's or celebrity's biography, a place or event unrelated to the theme. If a "
        "short video about the article could reasonably fit the theme above, it is NOT off-topic.\n"
        'First say what the article is about. JSON only: {"article_is_about": "...", "off_topic": false}', timeout)
    return dados.get("off_topic") is not True


def _usados_path() -> str:
    return os.path.join(pasta_dados(), "pautas_usadas.json")


def usados() -> set:
    try:
        with open(_usados_path(), encoding="utf-8") as f:
            return set(json.load(f).get("artigos", []))
    except (OSError, ValueError):
        return set()


def marcar_usado(chave: str) -> None:
    lista = sorted(usados() | {chave})
    os.makedirs(pasta_dados(), exist_ok=True)
    with open(_usados_path(), "w", encoding="utf-8") as f:
        json.dump({"artigos": lista}, f, ensure_ascii=False, indent=1)


def _membros(lang: str, categoria: str, tipo: str, timeout: float) -> List[str]:
    r = _wiki(lang, {"action": "query", "list": "categorymembers", "cmtitle": PREFIXO[lang] + categoria,
                     "cmtype": tipo, "cmlimit": 200}, timeout)
    # "page" também traz portais e anexos; só artigos (espaço nominal 0) viram pauta
    return [m["title"] for m in r["query"].get("categorymembers", []) if tipo != "page" or m.get("ns") == 0]


def _artigos_do_nicho(cats: Dict[str, List[str]], timeout: float) -> Dict[str, str]:
    """{"en:Title": "Nome da categoria"} de 3 categorias sorteadas e de até 3 subcategorias de cada."""
    sorteio = random.sample([(lang, c) for lang, cs in cats.items() for c in cs], min(3, sum(len(c) for c in cats.values())))
    artigos: Dict[str, str] = {}
    for lang, cat in sorteio:
        for t in _membros(lang, cat, "page", timeout):
            artigos.setdefault(f"{lang}:{t}", cat)
        # sem subcategorias de ficção: "Fictional castaways" trouxe o personagem de série "Lucifer Morningstar"
        subcats = [s.split(":", 1)[1] for s in _membros(lang, cat, "subcat", timeout) if not _FICCAO.search(s)]
        for sub in random.sample(subcats, min(3, len(subcats))):
            for t in _membros(lang, sub, "page", timeout):
                artigos.setdefault(f"{lang}:{t}", cat)
    return artigos


def _resumos(chaves: List[str], timeout: float) -> List[Dict[str, Any]]:
    saida = []
    for lang in ("pt", "en"):
        titulos = [c.split(":", 1)[1] for c in chaves if c.startswith(lang + ":")]
        if not titulos:
            continue
        r = _wiki(lang, {"action": "query", "prop": "extracts|info|pageprops", "inprop": "url", "ppprop": "disambiguation",
                         "exintro": 1, "explaintext": 1, "exlimit": 20, "titles": "|".join(titulos[:20])}, timeout)
        for p in r["query"].get("pages", []):
            texto = re.sub(r"\s+", " ", p.get("extract", "")).strip()
            if len(texto) >= MIN_CHARS and "disambiguation" not in (p.get("pageprops") or {}):
                saida.append({"lang": lang, "titulo": p["title"], "url": p.get("fullurl", ""), "resumo": texto})
    return saida


def _visualizacoes(lang: str, titulo: str, timeout: float) -> int:
    fim = dt.date.today() - dt.timedelta(days=1)
    ini = fim - dt.timedelta(days=29)
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
           f"{lang}.wikipedia/all-access/user/{quote(titulo.replace(' ', '_'), safe='')}/daily/"
           f"{ini:%Y%m%d}/{fim:%Y%m%d}")
    try:
        r = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
        r.raise_for_status()
        return sum(i.get("views", 0) for i in r.json().get("items", []))
    except Exception:
        return 0  # sem dados (artigo novo ou API fora) não impede a pauta, só a põe no fim da fila


def _fatos(art: Dict[str, Any], timeout: float) -> str:
    """Abertura + primeiras seções, sem os títulos de seção, cortado no fim de uma frase. Baixa o texto inteiro e
    corta aqui: o `exchars` da API não passa de 1.200 letras (no 1º teste os fatos vieram com ~1.200)."""
    try:
        r = _wiki(art["lang"], {"action": "query", "prop": "extracts", "explaintext": 1, "titles": art["titulo"]}, timeout)
        texto = r["query"]["pages"][0].get("extract", "")
    except Exception:
        texto = ""
    texto = re.split(r"\n=+ *(See also|Veja também|Ver também|References|Referências|Notes|Notas|Bibliografia|Further reading|External links|Ligações externas) *=+", texto or "")[0]
    texto = re.sub(r"\n=+[^=\n]+=+\n", "\n", texto or art["resumo"])
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) > MAX_CHARS_FATOS:
        texto = texto[:MAX_CHARS_FATOS].rsplit(". ", 1)[0] + "."
    return f"[Wikipédia ({art['lang']}): {art['titulo']}] {texto}"


def _titulo_pt(art: Dict[str, Any], timeout: float) -> str:
    """Nome do artigo na Wikipédia em português (link entre idiomas), para o título de reserva não sair em inglês."""
    if art["lang"] == "pt":
        return art["titulo"]
    try:
        r = _wiki(art["lang"], {"action": "query", "prop": "langlinks", "lllang": "pt", "titles": art["titulo"]}, timeout)
        links = r["query"]["pages"][0].get("langlinks") or []
        return links[0]["title"] if links else art["titulo"]
    except Exception:
        return art["titulo"]


def _problemas_titulo(titulo: str, fonte: str) -> List[str]:
    falhas = []
    if not 25 <= len(titulo) <= 90:
        falhas.append(f"length {len(titulo)} characters (must be 40 to 75)")
    if any(g in titulo.lower() for g in GENERICAS):
        falhas.append("generic clickbait phrase")
    if _CAIXA_ALTA.match(titulo):
        falhas.append("all caps")
    # nomes próprios em inglês ("Doing What Matters") podem ter 1 palavra inglesa; 2+ ou nenhuma palavra do português = outro idioma
    if not _PALAVRAS_PT.search(titulo) or len(_PALAVRAS_EN.findall(titulo)) >= 2:
        falhas.append("not in Brazilian Portuguese")
    inventados = [n for n in re.findall(r"\d+", titulo) if not re.search(rf"(?<!\d){n}(?!\d)", fonte)]
    if inventados:
        falhas.append("numbers not in the article: " + ", ".join(inventados))
    return falhas


def _titulo_falso(titulo: str, art: Dict[str, Any], fatos: str, timeout: float) -> bool:
    """A IA confere se o título afirma algo que o texto não diz. No teste de 21/10 o Bacillus subtilis (uma bactéria)
    saiu como "O Bacteriófago que Revolucionou a Biologia"; as regras de formato não pegam isso."""
    try:
        dados = _ollama(
            f'Video title: "{titulo}"\nWikipedia article: {art["titulo"]}\nText: {fatos[:2500]}\n\n'
            "Does the title say anything false or not supported by the text (wrong kind of thing, wrong person, place, "
            "claim or exaggeration such as 'revolutionized' when the text does not say so)?\n"
            'JSON only: {"problem": "...", "unsupported": false}', timeout)
    except Exception:
        return False  # sem a conferência, fica a validação de formato
    return dados.get("unsupported") is True


def escrever_titulo(art: Dict[str, Any], fatos: str, timeout: float) -> Optional[str]:
    # 3 opções por pedido: no teste de 21/10 os títulos saíam com palavras em espanhol/inglês ("Crisis", "Biases")
    # ou inventadas ("desintegurar", "Extrapessoais"); a 1ª opção que passa na validação fica.
    nome_pt = _titulo_pt(art, timeout)
    pedido = (
        "Write 3 alternative titles for a YouTube video in Brazilian Portuguese about the subject of the Wikipedia "
        "text below.\n"
        "Rules: 40 to 75 characters; intriguing but TRUE: everything the title claims must be in the text; name the "
        "subject or a concrete detail of it; no numbers or years that are not in the text; no clickbait phrases "
        "('você não vai acreditar', 'chocante', 'ninguém te contou', 'o que você não sabia'); normal capitalization "
        "(not all caps); no emojis, no hashtags. If the subject is a legend, hoax or unconfirmed, the title must not "
        "present it as proven fact.\n"
        "Language: natural, correctly spelled Brazilian Portuguese only. No English or Spanish words (write 'crise', "
        "not 'crisis'; 'vieses', not 'biases'); keep only proper names in the original. Do not invent words.\n"
        f"Wikipedia article: {art['titulo']} (Portuguese name: {nome_pt})\nText: {fatos[:2500]}\n\n"
        'JSON only: {"titles": ["...", "...", "..."]}'
    )
    falhas: List[str] = []
    for _ in range(2):
        extra = f"\n\nThe previous titles failed: {'; '.join(falhas)}. Write new ones." if falhas else ""
        try:
            opcoes = _ollama(pedido + extra, timeout).get("titles") or []
        except Exception:
            break
        falhas = []
        for t in opcoes if isinstance(opcoes, list) else [opcoes]:
            titulo = re.sub(r"\s+", " ", str(t)).strip().strip('"')
            problemas = _problemas_titulo(titulo, f"{art['titulo']} {nome_pt} {fatos}")
            if titulo and not problemas and not _titulo_falso(titulo, art, fatos, timeout):
                return titulo
            falhas += problemas or ["a claim in the title is not supported by the text"]
    # Reserva: o nome do artigo em português (sem promessa nenhuma, mas verdadeiro). Artigo só em inglês não tem
    # reserva ("2025 Bangkok road collapse" virou título no teste de 21/10): None faz o #01 pular para o próximo.
    if art["lang"] == "pt" or nome_pt != art["titulo"]:
        return nome_pt
    return None


def sugerir_pauta(nicho: str, timeout: float = 60) -> Optional[Dict[str, Any]]:
    """Devolve a pauta ({"titulo", "fatos", "fontes", "artigo", "categoria", "visualizacoes_30d", "bloqueados"...})
    ou None se o nicho não tem categorias. Sem candidato aprovado levanta ValueError; rede/Ollama fora levanta
    a exceção original (o agente cai no fluxo antigo)."""
    cats = categorias(nicho)
    if not cats:
        return None
    ja_usados = usados()

    def generico(titulo: str, cat: str) -> bool:
        # artigo principal da própria categoria ("Robótica" em Robótica, "Shipwreck" em Shipwrecks): assunto amplo demais
        t, c = titulo.lower(), cat.lower()
        return t == c or c.startswith(t) or t.startswith(c)

    artigos = {k: c for k, c in _artigos_do_nicho(cats, timeout).items()
               if k not in ja_usados and not _LISTA.match(k.split(":", 1)[1]) and not generico(k.split(":", 1)[1], c)}
    if not artigos:
        raise ValueError("as categorias sorteadas não têm artigos novos")
    candidatos = _resumos(random.sample(list(artigos), min(CANDIDATOS, len(artigos))), timeout)
    for c in candidatos:
        c["visualizacoes_30d"] = _visualizacoes(c["lang"], c["titulo"], timeout)
    candidatos.sort(key=lambda c: -c["visualizacoes_30d"])

    bloqueados, fora_do_tema = [], []
    cfg = _config(nicho)
    nome_nicho, descricao = cfg.get("nome") or nicho, cfg.get("descricao") or cfg.get("nome") or nicho
    for c in candidatos:  # até CANDIDATOS (10); a checagem de tema leva ~1 s por artigo com o modelo carregado
        if not combina_com_nicho(nome_nicho, descricao, c, timeout):
            fora_do_tema.append(f"{c['lang']}: {c['titulo']}")
            continue
        filtro = sensitive_filter.verificar(c["titulo"], c["resumo"], timeout=timeout)
        if filtro["bloqueado"]:
            bloqueados.append(f"{c['lang']}: {c['titulo']} ({filtro['motivo']})")
            continue
        fatos = _fatos(c, timeout)
        if len(fatos) < MIN_CHARS_FATOS:
            continue
        filtro = sensitive_filter.verificar(c["titulo"], fatos, usar_ia=False)  # o texto longo pode trazer mais
        if filtro["bloqueado"]:
            bloqueados.append(f"{c['lang']}: {c['titulo']} ({filtro['motivo']})")
            continue
        titulo = escrever_titulo(c, fatos, timeout)
        if not titulo:
            continue
        return {
            "titulo": titulo,
            "fatos": fatos,
            "fontes": [c["url"]] if c["url"] else [],
            "artigo": f"{c['lang']}: {c['titulo']}",
            "chave": f"{c['lang']}:{c['titulo']}",
            "categoria": artigos[f"{c['lang']}:{c['titulo']}"],
            "visualizacoes_30d": c["visualizacoes_30d"],
            "bloqueados": bloqueados,
            "fora_do_tema": fora_do_tema,
            "candidatos": len(candidatos),
        }
    raise ValueError(f"nenhum dos {len(candidatos)} candidatos passou ({len(fora_do_tema)} fora do tema do nicho, "
                     f"{len(bloqueados)} bloqueados por tema sensível)")
