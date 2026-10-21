"""Testes do Revisor QA (#07): conferência do roteiro contra os fatos da Wikipédia.

Isolado: pasta de dados temporária. O Ollama é interceptado (roda sem o modelo).

Rodar: .venv\\Scripts\\python.exe automation\\test_revisor.py
"""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from automation import fact_check as fc  # noqa: E402
from automation import fact_research as fr  # noqa: E402
from automation.agents import QualityControlAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, Batch, VideoBrief, VideoItem  # noqa: E402

_dumps = json.dumps  # os interceptadores recebem um argumento chamado json (como o httpx), que esconde o módulo
FATOS_UVB = ("[Wikipédia (en): UVB-76] UVB-76, also known as \"the Buzzer\", is a shortwave radio station that broadcasts "
             "on the frequency 4625 kHz. It broadcasts a short, monotonous buzz tone, repeating at a rate of approximately "
             "25 tones per minute, 24 hours per day. The earliest known recording dates from 1982. Occasionally the buzzer "
             "signal is interrupted and a voice transmission in Russian takes place.")


class _Resp:
    def __init__(self, dados):
        self.dados = dados

    def raise_for_status(self):
        pass

    def json(self):
        return self.dados


def _ollama(respostas, pedidos):
    respostas = list(respostas)

    def post(url, json=None, timeout=None):
        pedidos.append(json)
        r = respostas.pop(0)
        if isinstance(r, Exception):
            raise r
        return _Resp({"message": {"content": r if isinstance(r, str) else _dumps(r, ensure_ascii=False)}})
    return post


def _com_ollama(respostas, fn):
    pedidos, original = [], fr.httpx.post
    fr.httpx.post = _ollama(respostas, pedidos)
    try:
        return fn(), pedidos
    finally:
        fr.httpx.post = original


def _video(roteiro, fatos=FATOS_UVB, titulo="UVB-76: a rádio que zumbe sem parar"):
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    b = VideoBrief(title=titulo, script_body=roteiro, research_facts=fatos,
                   sources_rationale={"research": "Tema: Numbers stations. Wikipédia: en: UVB-76 (2112 visualizações em 30 dias)"})
    return VideoItem(batch_id="teste-revisor", title=titulo, brief=b, agents=agentes)


def _ag7(v):
    return next(a for a in v.agents if a.order == 7)


TUDO_CONFIRMADO = {"claims": [{"claim": "A UVB-76 transmite em 4625 kHz", "verdict": "supported", "evidence": "4625 kHz"}]}


def test_revisor():
    # 1. Números por extenso (pt) e em inglês; "um/uma" não contam
    assert [(n["texto"], n["valor"]) for n in fc.numeros("derrubou seis aviões em apenas três dias e vinte mil pessoas")] == \
        [("seis", 6), ("três", 3), ("vinte mil", 20000)]
    assert [n["valor"] for n in fc.numeros("cento e vinte e três e 1,5 bilhão e 20.000")] == [123, 1.5e9, 20000]
    assert [n["valor"] for n in fc.numeros("six planes, 20,000 feet, three hundred and twenty-five", "en")] == [6, 20000, 325]
    assert fc.numeros("Um homem encontrou uma porta.") == []
    print("[OK] números em dígitos e por extenso (pt e en); 'um/uma' ignorados")

    # 2. Números inventados e unidades trocadas (o caso "25 tons por minuto" -> "a cada 25 segundos")
    assert fc.conferir_numeros("Derrubou seis aviões em apenas três dias.", "shot down six Russian planes") == ['número "três" não está nos fatos']
    assert fc.conferir_numeros("Desde 1982, 25 tons por minuto.", FATOS_UVB) == []
    assert fc.conferir_numeros("Benjamin Graham e David Dodd, dois gênios de Columbia.", "Graham and Dodd taught at Columbia.") == [], \
        "'dois' por extenso contando quem acabou de ser citado não reprova (reprovou um roteiro fiel)"
    assert fc.conferir_unidades("repete o som a cada 25 segundos", FATOS_UVB) == ['"25 segundo" no roteiro, mas nos fatos 25 vem com minuto']
    assert fc.conferir_unidades("cerca de 25 tons por minuto, 24 horas por dia", FATOS_UVB) == []
    assert fc.conferir_unidades("chega a 85 pés", "approximately 85 m (279 ft) deep") != [], "a conversão entre parênteses não vale"
    assert fc.conferir_unidades("chega a 85 metros", "approximately 85 m (279 ft) deep") == []
    print("[OK] número inventado por extenso e unidade trocada viram problema; unidade certa passa")

    # 3. Revisor aprova roteiro fiel: DRAFT_READY, checklist com conferência real
    v = _video("A UVB-76 transmite na frequência de 4625 kHz, cerca de 25 tons por minuto, desde 1982.")
    _, pedidos = _com_ollama([TUDO_CONFIRMADO], lambda: QualityControlAgent().execute(v))
    assert v.status == "DRAFT_READY" and v.qa.approved and v.qa.factual_confidence_high and _ag7(v).status == "COMPLETED", _ag7(v).message
    assert len(pedidos) == 1 and pedidos[0]["options"]["num_predict"] == 1500 and "4625 kHz" in pedidos[0]["messages"][0]["content"]
    assert any("não são verificados" in n for n in v.qa.notes), "o checklist não pode fingir que conferiu legenda e áudio"
    print(f"[OK] roteiro fiel aprovado | {_ag7(v).message}")

    # 4. Unidade trocada reprova mesmo com a IA dizendo que está tudo certo (foi o que a IA de 7B fez de verdade)
    v = _video("A UVB-76 repete um som monótono a cada 25 segundos, desde 1982.")
    _com_ollama([{"claims": [{"claim": "repete a cada 25 segundos", "verdict": "supported", "evidence": "25 tones per minute"}]}],
                lambda: QualityControlAgent().execute(v))
    assert v.status == "REJECTED" and not v.qa.approved and _ag7(v).status == "FAILED" and "25 segundo" in _ag7(v).message, _ag7(v).message
    print(f"[OK] unidade trocada reprova o vídeo | {_ag7(v).message[:90]}…")

    # 5. Contradição apontada pela IA reprova; "fora dos fatos" vira só observação
    v = _video("A UVB-76 fica na Grécia e transmite em 4625 kHz desde 1982.")
    _com_ollama([{"claims": [{"claim": "fica na Grécia", "verdict": "contradicted", "evidence": "Russian station"},
                             {"claim": "é muito famosa", "verdict": "not_found", "evidence": ""}]}],
                lambda: QualityControlAgent().execute(v))
    assert v.status == "REJECTED" and any("contradiz os fatos" in n for n in v.qa.notes)
    assert any(n.startswith("não está nos fatos") for n in v.qa.notes)
    v = _video("A UVB-76 transmite em 4625 kHz desde 1982 e é muito famosa.")
    _com_ollama([{"claims": [{"claim": "é muito famosa", "verdict": "not_found", "evidence": ""}]}], lambda: QualityControlAgent().execute(v))
    assert v.status == "DRAFT_READY" and "1 observação" in _ag7(v).message, _ag7(v).message
    print("[OK] contradição reprova; afirmação fora dos fatos só vira observação")

    # 6. IA: JSON cortado na 1ª tentativa -> 2ª tentativa; IA fora nas duas -> só números, e o checklist diz isso
    v = _video("A UVB-76 transmite em 4625 kHz desde 1982.")
    _, pedidos = _com_ollama(['{"claims": [{"claim": "cortado', TUDO_CONFIRMADO], lambda: QualityControlAgent().execute(v))
    assert len(pedidos) == 2 and v.qa.factual_confidence_high, "2ª tentativa depois do JSON cortado"
    v = _video("A UVB-76 transmite em 4625 kHz desde 1982.")
    _com_ollama([fr.httpx.ConnectError("fora"), fr.httpx.ConnectError("fora")], lambda: QualityControlAgent().execute(v))
    assert v.status == "DRAFT_READY" and not v.qa.factual_confidence_high and "só pelos números" in _ag7(v).message, _ag7(v).message
    v = _video("A UVB-76 surgiu há três décadas.")
    _com_ollama([fr.httpx.ConnectError("fora"), fr.httpx.ConnectError("fora")], lambda: QualityControlAgent().execute(v))
    assert v.status == "REJECTED", "sem IA, a camada de números continua reprovando"
    print("[OK] JSON cortado tenta de novo; IA fora fica só com os números (e reprova o que eles pegam)")

    # 7. Sem fatos (fluxo antigo): aprova sem conferir e avisa, sem chamar a IA
    v = _video("Uma lenda contada no interior.", fatos="")
    _, pedidos = _com_ollama([], lambda: QualityControlAgent().execute(v))
    assert v.status == "DRAFT_READY" and not pedidos and not v.qa.factual_confidence_high and "sem conferência" in _ag7(v).message
    print("[OK] sem fatos: aprovado sem conferência, com aviso")

    # 8. Orquestrador: QA reprovado não passa para o Designer (#08), o Publicador (#09) nem o Analista (#10)
    from automation.orchestrator import AutomationOrchestrator
    orq, chamados = AutomationOrchestrator(), []

    class _Falso:
        def __init__(self, nome):
            self.nome = nome

        def execute(self, video, *a, **k):
            chamados.append(self.nome)

    for nome in ["research", "strategy", "script", "visual", "video", "audio", "design", "publish", "analytics"]:
        setattr(orq, f"agent_{nome}", _Falso(nome))
    v = _video("A UVB-76 repete um som a cada 25 segundos.")
    _com_ollama([TUDO_CONFIRMADO], lambda: orq._process_video_pipeline(Batch(channel_id="teste", niche="terror"), v))
    assert chamados == ["research", "strategy", "script", "visual", "video", "audio"] and v.status == "REJECTED", chamados
    print("[OK] orquestrador: QA reprovado para antes do Designer, do Publicador e do Analista")


if __name__ == "__main__":
    test_revisor()
    print("\nTODOS OS TESTES DO REVISOR PASSARAM")
