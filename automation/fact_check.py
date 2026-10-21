"""Conferência do roteiro contra os fatos da Wikipédia, para o Revisor QA (#07).

Motivo (testes de 21/10): o Roteirista distorcia fatos válidos ("25 tons por minuto" virou "a cada 25 segundos") e
inventava números por extenso ("seis aeronaves em apenas três dias"), que a checagem de dígitos do #03 não vê.

Duas camadas:
1. Números (sem IA): todos os números do roteiro e do título, em dígitos ou por extenso em português ("três",
   "vinte mil", "20.000"), precisam aparecer nos fatos (dígitos ou por extenso em português ou inglês: "three",
   "20,000") ou no título da pauta. O 1 fica de fora ("um"/"uma" também são artigos). E a unidade de tempo,
   distância ou frequência que acompanha o número precisa ser a mesma dos fatos ("25 segundos" x "25 … per minute").
2. Afirmações (IA local): o Ollama lista as afirmações factuais do título e do roteiro e diz, para cada uma, se os
   fatos confirmam, contradizem ou não falam dela. Contradição reprova; "não está nos fatos" vira observação
   (o roteiro pode ter frases de transição e hipóteses ditas como hipóteses).
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Set

UNIDADES_PT = {"zero": 0, "dois": 2, "duas": 2, "três": 3, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7,
               "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14,
               "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20,
               "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80,
               "noventa": 90, "cem": 100, "cento": 100, "duzentos": 200, "duzentas": 200, "trezentos": 300,
               "trezentas": 300, "quatrocentos": 400, "quatrocentas": 400, "quinhentos": 500, "quinhentas": 500,
               "seiscentos": 600, "seiscentas": 600, "setecentos": 700, "setecentas": 700, "oitocentos": 800,
               "oitocentas": 800, "novecentos": 900, "novecentas": 900}
MULT_PT = {"mil": 1_000, "milhão": 1_000_000, "milhao": 1_000_000, "milhões": 1_000_000, "milhoes": 1_000_000,
           "bilhão": 1_000_000_000, "bilhao": 1_000_000_000, "bilhões": 1_000_000_000, "bilhoes": 1_000_000_000}
UNIDADES_EN = {"zero": 0, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
               "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
               "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
               "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100, "dozen": 12}
MULT_EN = {"thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000}
_TOKEN = re.compile(r"\d+(?:[.,]\d+)*|[a-zà-ÿ]+", re.I)


def _digito(t: str, lang: str) -> float:
    """"20.000" (pt) / "20,000" (en) = 20000; "1,5" (pt) / "1.5" (en) = 1.5."""
    milhar, decimal = (".", ",") if lang == "pt" else (",", ".")
    if re.fullmatch(rf"\d{{1,3}}(\{milhar}\d{{3}})+", t):
        return float(t.replace(milhar, ""))
    return float(t.replace(milhar, "").replace(decimal, "."))


def numeros(texto: str, lang: str = "pt") -> List[Dict[str, Any]]:
    """[{"texto": "vinte mil", "valor": 20000.0}, ...] em dígitos e por extenso (pt ou en)."""
    unidades, mult, liga = (UNIDADES_PT, MULT_PT, "e") if lang == "pt" else (UNIDADES_EN, MULT_EN, "and")
    tokens = [(m.group(0), m.group(0).lower()) for m in _TOKEN.finditer(texto)]
    saida, i = [], 0
    while i < len(tokens):
        orig, t = tokens[i]
        if t[0].isdigit() or t in unidades:
            partes, total, atual = [orig], 0.0, _digito(t, lang) if t[0].isdigit() else float(unidades[t])
            j = i + 1
            while j < len(tokens):
                o2, t2 = tokens[j]
                if t2 in mult:
                    total += (atual or 1) * mult[t2]
                    atual = 0.0
                elif t2 == "hundred" and lang == "en":
                    atual *= 100
                elif t2 == liga and j + 1 < len(tokens) and tokens[j + 1][1] in unidades:
                    pass
                elif t2 in unidades and not tokens[j - 1][1][0].isdigit():
                    atual += unidades[t2]
                else:
                    break
                partes.append(o2)
                j += 1
            saida.append({"texto": " ".join(partes), "valor": total + atual})
            i = j
        else:
            i += 1
    return saida


# Unidades de medida por dimensão (pt e en). "tons"/"toneladas" ficam de fora: em pt "tons" também é tom musical.
UNIDADES_MEDIDA = {
    "tempo": {"segundo": ("segundo", "segundos", "second", "seconds", "sec"), "minuto": ("minuto", "minutos", "minute", "minutes", "min"),
              "hora": ("hora", "horas", "hour", "hours"), "dia": ("dia", "dias", "day", "days"),
              "semana": ("semana", "semanas", "week", "weeks"), "mes": ("mês", "meses", "month", "months"),
              "ano": ("ano", "anos", "year", "years")},
    "distancia": {"m": ("metro", "metros", "metre", "metres", "meter", "meters", "m"),
                  "km": ("quilômetro", "quilômetros", "quilometro", "quilometros", "km", "kilometre", "kilometres", "kilometer", "kilometers"),
                  "cm": ("centímetro", "centímetros", "cm", "centimetre", "centimetres", "centimeter", "centimeters"),
                  "pe": ("pé", "pés", "foot", "feet", "ft"), "milha": ("milha", "milhas", "mile", "miles", "mi")},
    "frequencia": {"hz": ("hz", "hertz"), "khz": ("khz", "quilohertz", "kilohertz"), "mhz": ("mhz", "megahertz")},
}
_UNIDADE = {forma: (dim, nome) for dim, nomes in UNIDADES_MEDIDA.items() for nome, formas in nomes.items() for forma in formas}


def _unidades_perto(texto: str, lang: str, janela: int) -> Dict[float, List[tuple]]:
    """{valor: [(dimensão, unidade), ...]} das unidades de medida até `janela` palavras depois de cada número."""
    tokens = [m.group(0).lower() for m in _TOKEN.finditer(texto)]
    saida: Dict[float, List[tuple]] = {}
    for n in numeros(texto, lang):
        partes = n["texto"].lower().split()
        for i in range(len(tokens) - len(partes) + 1):
            if tokens[i:i + len(partes)] == partes:
                seguintes = tokens[i + len(partes): i + len(partes) + janela]
                # só a 1ª unidade: em "85 m (279 ft)" o "ft" é da conversão, não do 85
                primeira = next((_UNIDADE[t] for t in seguintes if t in _UNIDADE), None)
                if primeira:
                    saida.setdefault(n["valor"], []).append(primeira)
    return saida


def conferir_unidades(roteiro: str, fatos: str) -> List[str]:
    """Número com unidade de medida no roteiro cuja unidade não bate com a do mesmo número nos fatos. Pega a troca
    de "25 tones per minute" por "a cada 25 segundos", que a IA de 7B marcou como confirmada no teste de 21/10."""
    do_roteiro = _unidades_perto(roteiro, "pt", 2)  # "25 segundos", "85 metros de profundidade"
    dos_fatos: Dict[float, List[tuple]] = {}
    for lang in ("en", "pt"):
        for v, us in _unidades_perto(fatos, lang, 3).items():  # "25 tones per minute"
            dos_fatos.setdefault(v, []).extend(us)
    problemas = []
    for valor, unidades in do_roteiro.items():
        for dim, nome in unidades[:1]:
            mesma_dim = [u for u in dos_fatos.get(valor, []) if u[0] == dim]
            if mesma_dim and (dim, nome) not in mesma_dim:
                fatos_txt = ", ".join(sorted({u[1] for u in mesma_dim}))
                problemas.append(f"\"{valor:g} {nome}\" no roteiro, mas nos fatos {valor:g} vem com {fatos_txt}")
    return problemas


def _valores(texto: str) -> Set[float]:
    return {n["valor"] for lang in ("pt", "en") for n in numeros(texto, lang)}


def conferir_numeros(roteiro: str, fatos: str, titulo_pauta: str = "") -> List[str]:
    """Números do roteiro que não estão nos fatos nem no título da pauta (o 1 é ignorado)."""
    fonte = _valores(fatos) | _valores(titulo_pauta)
    vistos, problemas = set(), []
    for n in numeros(roteiro, "pt"):
        # "dois/duas" por extenso costuma contar o que o roteiro acabou de citar ("Graham e Dodd, dois gênios"):
        # reprovou um roteiro fiel no teste de 21/10. Em dígitos ("2 anos") continua conferido; 3+ também ("três dias").
        if n["texto"].lower() in ("dois", "duas"):
            continue
        if n["valor"] in (0, 1) or n["valor"] in fonte or n["texto"].lower() in vistos:
            continue
        vistos.add(n["texto"].lower())
        problemas.append(f"número \"{n['texto']}\" não está nos fatos")
    return problemas


def conferir_afirmacoes(titulo: str, roteiro: str, fatos: str, timeout: float = 120) -> List[Dict[str, str]]:
    """[{"claim", "verdict": supported|contradicted|not_found, "evidence"}] pela IA local."""
    from automation.fact_research import _ollama

    dados = _ollama(
        "You are a fact-checker. Compare the video title and narration (Brazilian Portuguese) with the source facts "
        "(Wikipedia). List every factual claim of the title and narration (skip opinions, questions, calls to action "
        "and claims explicitly told as legend, rumor or possibility). For each claim, verdict:\n"
        "- supported: the facts say the same thing;\n"
        "- contradicted: the facts say something different (pay close attention to numbers, units and rates — e.g. "
        "'25 tones per minute' is NOT 'every 25 seconds' —, dates, durations, names, places and who did what);\n"
        "- not_found: the facts do not mention it.\n"
        f"Title: {titulo}\nNarration: {roteiro}\n\nFacts: {fatos[:3500]}\n\n"
        'JSON only: {"claims": [{"claim": "...", "verdict": "supported", "evidence": "short quote from the facts"}]}',
        timeout)
    claims = dados.get("claims") if isinstance(dados.get("claims"), list) else []
    return [{"claim": str(c.get("claim", ""))[:300], "verdict": str(c.get("verdict", "")).lower().strip(),
             "evidence": str(c.get("evidence", ""))[:300]} for c in claims if isinstance(c, dict)]


def conferir(titulo: str, roteiro: str, fatos: str, titulo_pauta: str = "", usar_ia: bool = True,
             timeout: float = 120) -> Dict[str, Any]:
    """Devolve {"aprovado", "problemas": [...], "observacoes": [...], "afirmacoes": [...], "ia": bool}.
    Sem fatos não há o que conferir: aprovado com observação. Erro do Ollama: fica só a camada de números."""
    if not fatos.strip():
        return {"aprovado": True, "problemas": [], "afirmacoes": [], "ia": False,
                "observacoes": ["sem fatos da Wikipédia para conferir o roteiro (pauta do fluxo antigo)"]}
    problemas = conferir_numeros(f"{titulo}. {roteiro}", fatos, titulo_pauta) + conferir_unidades(f"{titulo}. {roteiro}", fatos)
    observacoes, afirmacoes, ia = [], [], False
    if usar_ia:
        for tentativa in range(2):  # 2ª tentativa: no teste de 21/10 uma resposta veio com JSON cortado
            try:
                afirmacoes, ia = conferir_afirmacoes(titulo, roteiro, fatos, timeout), True
                break
            except Exception as e:
                if tentativa:
                    observacoes.append(f"conferência das afirmações pela IA indisponível ({type(e).__name__}); só números conferidos")
    for a in afirmacoes:
        if a["verdict"] == "contradicted":
            problemas.append(f"contradiz os fatos: \"{a['claim']}\"" + (f" (fatos: \"{a['evidence']}\")" if a["evidence"] else ""))
        elif a["verdict"] == "not_found":
            observacoes.append(f"não está nos fatos: \"{a['claim']}\"")
    return {"aprovado": not problemas, "problemas": problemas, "observacoes": observacoes, "afirmacoes": afirmacoes, "ia": ia}
