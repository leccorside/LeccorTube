"""Filtro de temas sensíveis, aplicado à pauta no Pesquisador (#01) e de novo no Roteirista (#03), antes do roteiro.

Motivo: no lote de teste de 21/10 a pauta "As 5 melhores histórias assustadoras" virou um roteiro sobre o
"Srpski film" (abuso infantil e necrofilia), com essas palavras nas tags.

Duas camadas:
1. Palavras-chave (sem IA, não falha): termos de abuso sexual de menores, violência sexual, necrofilia, incesto e
   pornografia bloqueiam com qualquer menção, mesmo de passagem (conservador de propósito). Suicídio e
   automutilação bloqueiam se aparecerem no título ou 3+ vezes no texto; menos que isso, decide a 2ª camada.
   Tragédias reais recentes com vítimas menores de idade (pedido do usuário em 21/10, depois de o sequestro das
   alunas de Chibok, em 2014, virar pauta): bloqueiam quando uma mesma frase cita menores e uma violência
   (sequestro, morte, massacre, desaparecimento) e o texto tem um ano dos últimos ANOS_RECENTES anos.
2. IA local: o Ollama diz se o assunto **central** é um desses temas.

Para mudar o que é bloqueado, editar TERMOS_BLOQUEIO, TERMOS_SUSPEITA, MENORES, VIOLENCIA, ANOS_RECENTES e
_temas_ia(). Teorias da conspiração, guerras recentes e religião NÃO são bloqueadas: decisão do usuário em
21/10/2026 (podem virar pauta). Lendas e casos antigos com crianças (ex.: o flautista de Hamelin, 1284) também não.
"""
from __future__ import annotations

import datetime as dt
import re
from typing import Any, Dict, Optional

TERMOS_BLOQUEIO = re.compile(
    r"pedofil|paedophil|pedophil|abuso sexual|abuso infantil|child abuse|sexual abuse|child sexual|"
    r"pornografia infantil|child pornograph|explora[cç][aã]o sexual|sexual exploitation|"
    r"viol[eê]ncia sexual|sexual violence|sexual assault|agress[aã]o sexual|estupr|\brap(e|ed|es|ist|ists|ing)\b|"
    r"necrofil|necrophil|incest|pornogra|molest",
    re.I,
)
TERMOS_SUSPEITA = re.compile(r"suic[ií]d|automutila|self-harm|self harm|self-mutilation", re.I)

ANOS_RECENTES = 30
MENORES = re.compile(
    r"\b(child|children|kids?|minors?|schoolgirls?|schoolboys?|schoolchildren|pupils?|teenagers?|teens|boys?|girls?|"
    r"infants?|bab(y|ies)|toddlers?|crian[cç]as?|menores|meninas?|meninos?|alun[oa]s|adolescentes|beb[eê]s?|"
    r"estudantes|students?)\b",
    re.I,
)
VIOLENCIA = re.compile(
    r"kidnap|abduct|hostage|massacre|shooting|murder|killed|killing|stabb|slain|disappear|missing|"
    r"sequestr|rapt[oa]|ref[eé]ns|massacr|assassin|mort[oa]s|esfaque|tiroteio|desaparec",
    re.I,
)


def _temas_ia() -> str:
    return (
        "sexual abuse or sexual exploitation of minors; sexual violence or rape; suicide or self-harm (including "
        "methods or glorification); explicit sexual content or pornography; necrophilia or incest; a REAL event from "
        f"{dt.date.today().year - ANOS_RECENTES} onwards in which children or minors were victims (kidnapping, "
        "killing, massacre, abuse or disappearance)"
    )


def _tragedia_recente_com_menores(texto: str) -> Optional[str]:
    """Frase que cita menores e uma violência, num texto com um ano recente. Devolve o trecho ou None."""
    ano_atual = dt.date.today().year
    anos = [int(a) for a in re.findall(r"\b(19\d\d|20\d\d)\b", texto)]
    if not any(ano_atual - ANOS_RECENTES <= a <= ano_atual for a in anos):
        return None
    for frase in re.split(r"(?<=[.!?])\s+", texto):
        menor, violencia = MENORES.search(frase), VIOLENCIA.search(frase)
        if menor and violencia:
            return f"{menor.group(0)} + {violencia.group(0)}"
    return None


def verificar(titulo: str, texto: str, usar_ia: bool = True, timeout: float = 60) -> Dict[str, Any]:
    """Devolve {"bloqueado": bool, "motivo": str, "camada": "palavras"|"ia"|""}.
    Erro do Ollama na 2ª camada levanta exceção (quem chama decide; o #01 descarta o candidato)."""
    m = TERMOS_BLOQUEIO.search(f"{titulo}\n{texto}")
    if m:
        return {"bloqueado": True, "motivo": f"termo sensível: '{m.group(0)}'", "camada": "palavras"}
    m = TERMOS_SUSPEITA.search(titulo)
    if m:
        return {"bloqueado": True, "motivo": f"termo sensível no título: '{m.group(0)}'", "camada": "palavras"}
    # Medido em 21/10 nos resumos da Wikipédia: temas centrados em suicídio repetem o termo (Aokigahara 5x, desafio
    # da Baleia Azul 4x, saúde de Van Gogh 3x) e a IA os liberava como "menção de passagem"; menções de passagem
    # aparecem 1x (cerco de Masada, Lenda urbana)
    ocorrencias = TERMOS_SUSPEITA.findall(texto)
    if len(ocorrencias) >= 3:
        return {"bloqueado": True, "motivo": f"termo sensível repetido {len(ocorrencias)}x: '{ocorrencias[0]}'", "camada": "palavras"}
    trecho = _tragedia_recente_com_menores(f"{titulo}. {texto}")
    if trecho:
        return {"bloqueado": True, "motivo": f"tragédia recente com menores: '{trecho}'", "camada": "palavras"}
    if not usar_ia:
        return {"bloqueado": False, "motivo": "", "camada": ""}

    from automation.fact_research import _ollama

    suspeita = TERMOS_SUSPEITA.search(texto)
    dados = _ollama(
        "You screen topics for a general-audience YouTube channel (horror, curiosities, technology, finance).\n"
        f"Blocked themes: {_temas_ia()}.\n"
        "Is the MAIN subject of the topic below one of the blocked themes, or would a video about it need to "
        "describe one of them? A passing mention in a long text does not count. Dark but acceptable themes "
        "(legends, ghosts, old or legendary disappearances, historical battles, crimes without sexual content and "
        "without child victims) are NOT blocked.\n"
        f'Title: "{titulo}"\nText: {texto[:2000]}\n\n'
        'JSON only: {"main_subject": "...", "blocked": false, "theme": ""}', timeout)
    if dados.get("blocked") is True:
        return {"bloqueado": True, "motivo": f"IA: {dados.get('theme') or 'tema sensível'} ({dados.get('main_subject', '')})"[:200],
                "camada": "ia"}
    if suspeita and dados.get("blocked") is not False:  # resposta ambígua com suspeita no texto: bloqueia
        return {"bloqueado": True, "motivo": f"termo sensível sem confirmação da IA: '{suspeita.group(0)}'", "camada": "ia"}
    return {"bloqueado": False, "motivo": "", "camada": "ia"}
