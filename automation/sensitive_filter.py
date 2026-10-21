"""Filtro de temas sensíveis, aplicado à pauta no Pesquisador (#01) e de novo no Roteirista (#03), antes do roteiro.

Motivo: no lote de teste de 21/10 a pauta "As 5 melhores histórias assustadoras" virou um roteiro sobre o
"Srpski film" (abuso infantil e necrofilia), com essas palavras nas tags.

Duas camadas:
1. Palavras-chave (sem IA, não falha): termos de abuso sexual de menores, violência sexual, necrofilia, incesto e
   pornografia bloqueiam com qualquer menção, mesmo de passagem (conservador de propósito). Suicídio e
   automutilação bloqueiam se aparecerem no título ou 3+ vezes no texto; menos que isso, decide a 2ª camada.
2. IA local: o Ollama diz se o assunto **central** é um desses temas.

Para mudar o que é bloqueado, editar TERMOS_BLOQUEIO, TERMOS_SUSPEITA e TEMAS_IA. Teorias da conspiração, guerras
recentes e religião NÃO são bloqueadas: decisão do usuário em 21/10/2026 (podem virar pauta).
"""
from __future__ import annotations

import re
from typing import Any, Dict

TERMOS_BLOQUEIO = re.compile(
    r"pedofil|paedophil|pedophil|abuso sexual|abuso infantil|child abuse|sexual abuse|child sexual|"
    r"pornografia infantil|child pornograph|explora[cç][aã]o sexual|sexual exploitation|"
    r"viol[eê]ncia sexual|sexual violence|sexual assault|agress[aã]o sexual|estupr|\brap(e|ed|es|ist|ists|ing)\b|"
    r"necrofil|necrophil|incest|pornogra|molest",
    re.I,
)
TERMOS_SUSPEITA = re.compile(r"suic[ií]d|automutila|self-harm|self harm|self-mutilation", re.I)

TEMAS_IA = (
    "sexual abuse or sexual exploitation of minors; sexual violence or rape; suicide or self-harm (including "
    "methods or glorification); explicit sexual content or pornography; necrophilia or incest"
)


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
    if not usar_ia:
        return {"bloqueado": False, "motivo": "", "camada": ""}

    from automation.fact_research import _ollama

    suspeita = TERMOS_SUSPEITA.search(texto)
    dados = _ollama(
        "You screen topics for a general-audience YouTube channel (horror, curiosities, technology, finance).\n"
        f"Blocked themes: {TEMAS_IA}.\n"
        "Is the MAIN subject of the topic below one of the blocked themes, or would a video about it need to "
        "describe one of them? A passing mention in a long text does not count. Dark but acceptable themes "
        "(legends, ghosts, disappearances, historical battles, crimes without sexual content) are NOT blocked.\n"
        f'Title: "{titulo}"\nText: {texto[:2000]}\n\n'
        'JSON only: {"main_subject": "...", "blocked": false, "theme": ""}', timeout)
    if dados.get("blocked") is True:
        return {"bloqueado": True, "motivo": f"IA: {dados.get('theme') or 'tema sensível'} ({dados.get('main_subject', '')})"[:200],
                "camada": "ia"}
    if suspeita and dados.get("blocked") is not False:  # resposta ambígua com suspeita no texto: bloqueia
        return {"bloqueado": True, "motivo": f"termo sensível sem confirmação da IA: '{suspeita.group(0)}'", "camada": "ia"}
    return {"bloqueado": False, "motivo": "", "camada": "ia"}
