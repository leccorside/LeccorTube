"""Escreve roteiros estruturados em pt-BR com a IA local para o Roteirista (#03)."""
from __future__ import annotations

import json
import re
from typing import Any, Dict

import httpx

from automation.video_adapter import MODELO_IA, OLLAMA_URL


def _texto(valor: Any, campo: str) -> str:
    if not isinstance(valor, str) or not valor.strip():
        raise ValueError(f"Ollama não devolveu o campo obrigatório '{campo}'.")
    return re.sub(r"\s+", " ", valor).strip()


def _lista(valor: Any, campo: str, minimo: int = 1) -> list[str]:
    if not isinstance(valor, list):
        raise ValueError(f"Ollama não devolveu a lista obrigatória '{campo}'.")
    itens = [re.sub(r"\s+", " ", str(v)).strip() for v in valor if str(v).strip()]
    if len(itens) < minimo:
        raise ValueError(f"Ollama devolveu poucos itens em '{campo}'.")
    return itens


def _frase(texto: str) -> str:
    # Hook, corpo e CTA são unidos numa narração só; sem pontuação final, o Diretor Visual (#04) juntaria as cenas.
    return texto if texto[-1] in ".!?…" else texto + "."


def escrever_roteiro(
    titulo: str,
    formato: str,
    duracao_segundos: int,
    contexto_pesquisa: str = "",
    timeout: float = 600,
) -> Dict[str, Any]:
    """Gera e valida hook, corpo, CTA, títulos e metadados em uma única chamada ao Ollama."""
    duracao = max(30, int(duracao_segundos or 60))
    # 2,3 palavras/s (~138 ppm): ritmo natural de narração, sem acelerar o texto para caber na meta.
    palavras_alvo = max(90, round(duracao * 2.3))
    minimo = round(palavras_alvo * 0.85)
    maximo = round(palavras_alvo * 1.15)
    pedido = (
        "You are the senior scriptwriter for a Brazilian Portuguese YouTube channel. Return valid JSON only, with "
        "no markdown. Write a vivid, natural and specific narration, not a template.\n"
        f'Topic/title: "{titulo}"\nFormat: {formato}\nTarget duration: {duracao} seconds.\n'
        f"Target {minimo} to {maximo} spoken words in the complete narration.\n"
        f"Research context available: {contexto_pesquisa or 'No additional verified context was supplied.'}\n\n"
        "Rules:\n"
        "- Write in Brazilian Portuguese for spoken narration. Start immediately with a concrete hook.\n"
        "- Do not use generic phrases such as 'você não vai acreditar', 'verdade chocante', 'ninguém te contou', "
        "or vague claims about researchers, investigations, secrets, or evidence.\n"
        "- Never invent dates, people, institutions, studies, statistics, quotations, or claims. Use only the supplied "
        "topic and research context. When a claim is uncertain, clearly frame it as possibility, legend, or open question.\n"
        "- Research notes, when present, are Wikipedia summaries picked automatically and may include an article about "
        "a broader field or a different subject with a similar name. Use only facts about the exact subject of the "
        "title. If the notes show the title's premise is a legend, hoax or exaggeration, tell it as such.\n"
        "- The body must progress through distinct ideas without repetition. The CTA must be one short final sentence.\n"
        "- Do not mention the visual style, prompts, AI, narrator, narration, script, or these instructions.\n"
        "- Provide exactly 3 useful alternative titles, 3 to 5 hashtags without #, and 5 to 10 search tags, all in "
        "Brazilian Portuguese.\n\n"
        "JSON schema: {\"hook\": \"...\", \"body\": \"...\", \"cta\": \"...\", "
        "\"alternative_titles\": [\"...\", \"...\", \"...\"], \"description\": \"...\", "
        "\"hashtags\": [\"...\"], \"tags\": [\"...\"]}"
    )
    def gerar(instrucoes: str, temperatura: float) -> Dict[str, Any]:
        r = httpx.post(f"{OLLAMA_URL}/api/chat", timeout=timeout, json={
            "model": MODELO_IA,
            "stream": False,
            "format": "json",
            # Mantém o modelo carregado para a reescrita e para o Diretor Visual (#04), que vem logo depois e o
            # descarrega com keep_alive 0 antes do ComfyUI; descarregar aqui custaria uma recarga a cada pedido.
            "keep_alive": "2m",
            "options": {"temperature": temperatura, "num_ctx": 8192},
            "messages": [{"role": "user", "content": instrucoes}],
        })
        r.raise_for_status()
        dados = json.loads(r.json()["message"]["content"])
        if not isinstance(dados, dict):
            raise ValueError("Ollama devolveu um roteiro em formato inválido.")
        hook = _frase(_texto(dados.get("hook"), "hook"))
        corpo = _frase(_texto(dados.get("body"), "body"))
        cta = _frase(_texto(dados.get("cta"), "cta"))
        alternativos = _lista(dados.get("alternative_titles"), "alternative_titles", 3)[:3]
        descricao = _texto(dados.get("description"), "description")
        hashtags = [re.sub(r"[^\wÀ-ÿ-]", "", x.lstrip("#")) for x in _lista(dados.get("hashtags"), "hashtags", 3)[:5]]
        tags = _lista(dados.get("tags"), "tags", 5)[:10]
        narracao = " ".join((hook, corpo, cta))
        return {
            "hook": hook, "body": corpo, "cta": cta, "script_body": narracao,
            "alternative_titles": alternativos, "description": descricao,
            "hashtags": [x for x in hashtags if x], "tags": tags,
            "word_count": len(narracao.split()), "target_words": palavras_alvo,
        }

    def neutralizar_autoridades(resultado: Dict[str, Any]) -> list[str]:
        ajustes = []
        contexto_lower = contexto_pesquisa.lower()
        grupos = "pesquisadores|especialistas|cientistas|historiadores|arqueólogos|estudos"
        padrao = re.compile(
            rf"\b(?:{grupos})(?:\s+e\s+(?:{grupos}))?\s+(?:acreditam|sugerem|indicam|apontam|afirmam|mostram)\s+que\b",
            re.I,
        )
        def troca(m: re.Match) -> str:
            # Maiúscula só no começo de frase ("…, e pesquisadores sugerem que" vira "…, e uma possibilidade é que").
            inicio = m.start() == 0 or m.string[:m.start()].rstrip()[-1:] in ".!?…"
            return "Uma possibilidade é que" if inicio else "uma possibilidade é que"

        for campo in ("hook", "body", "cta"):
            texto = resultado[campo]
            if any(x in texto.lower() and x not in contexto_lower for x in grupos.split("|")):
                novo = padrao.sub(troca, texto)
                if novo != texto:
                    resultado[campo] = novo
                    ajustes.append(f"atribuição não sustentada neutralizada em {campo}")
        resultado["script_body"] = " ".join((resultado["hook"], resultado["body"], resultado["cta"]))
        resultado["word_count"] = len(resultado["script_body"].split())
        return ajustes

    def problemas(resultado: Dict[str, Any], flexivel: bool = False) -> list[str]:
        falhas = []
        n = resultado["word_count"]
        minimo_aceito = round(palavras_alvo * (0.60 if flexivel else 0.85)) - 5
        # Após uma reescrita, contexto factual escasso pode justificar um roteiro menor; inventar para preencher é pior.
        if n < minimo_aceito:
            falhas.append(f"too short ({n} words; minimum {minimo_aceito})")
        elif n > maximo + 5:
            falhas.append(f"too long ({n} words; maximum {maximo + 5})")
        narracao = resultado["script_body"].lower()
        contexto_lower = contexto_pesquisa.lower()
        autoridades = ("pesquisadores", "especialistas", "cientistas", "historiadores", "arqueólogos", "estudos")
        indevidas = [x for x in autoridades if x in narracao and x not in contexto_lower]
        if indevidas:
            falhas.append("unsupported authorities or studies: " + ", ".join(indevidas))
        genericas = ("você não vai acreditar", "verdade chocante", "ninguém te contou")
        if any(x in narracao for x in genericas):
            falhas.append("generic clickbait phrase")
        # Datas e números que não estão no título nem no contexto são inventados (ex.: "datado de cerca de 700 a.C.").
        fonte = f"{titulo} {contexto_pesquisa}"
        inventados = sorted({n for n in re.findall(r"\d+", resultado["script_body"]) if not re.search(rf"(?<!\d){n}(?!\d)", fonte)})
        if inventados:
            falhas.append("numbers or dates not in the title or research context: " + ", ".join(inventados))
        return falhas

    def tentar(instrucoes: str, temperatura: float):
        # Resposta malformada (JSON inválido, campo faltando, poucas hashtags) conta como tentativa reprovada; antes
        # ela ia direto para a contingência, sem reescrita (visto no teste de 21/10: contingência em 2 s).
        # Erro de conexão com o Ollama não é ValueError e sobe para o agente.
        try:
            return gerar(instrucoes, temperatura), []
        except ValueError as e:  # json.JSONDecodeError também é ValueError
            return None, [f"invalid answer ({e})"]

    resultado, falhas = tentar(pedido, 0.55)
    if resultado is not None:
        falhas = problemas(resultado)
        if not falhas:
            return resultado
    primeiras = falhas
    # Até 2 reescritas: no teste real de 21/10 a 1ª resposta foi reprovada em 5 de 5 pedidos (fatos inventados ou
    # tamanho) e a 1ª reescrita em 1 de 3; com o modelo já carregado, cada pedido leva ~6 s.
    for _ in range(2):
        correcao = (
            pedido + "\n\nREWRITE REQUIRED. The previous answer failed validation: " + "; ".join(falhas) + ". "
            f"The complete narration must contain {minimo} to {maximo} words. Do not mention researchers, experts, "
            "scientists, historians, archaeologists, studies, or evidence unless those exact authorities appear in "
            "the supplied research context. Do not write any number, year or date that does not appear in the title or "
            "the research context. Rewrite from scratch and return only the required JSON."
        )
        resultado, falhas = tentar(correcao, 0.35)
        if resultado is None:
            continue
        resultado["first_attempt_failures"] = primeiras
        ajustes = neutralizar_autoridades(resultado)
        if ajustes:
            resultado["validation_adjustments"] = ajustes
        falhas = problemas(resultado, flexivel=True)
        if not falhas:
            return resultado
    raise ValueError("Roteiro reprovado após 2 correções: " + "; ".join(falhas))
