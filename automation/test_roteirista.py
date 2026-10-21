"""Testes isolados do Roteirista (#03), sem depender do Ollama real."""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from automation import script_writer as sw  # noqa: E402
from automation import sensitive_filter as sf  # noqa: E402

# O filtro de temas sensíveis (testado em test_pautas.py) fica só nas palavras-chave aqui: a camada de IA faria um
# pedido a mais ao Ollama interceptado e mudaria a contagem de pedidos do roteiro
_verificar = sf.verificar
sf.verificar = lambda t, x, usar_ia=True, timeout=60: _verificar(t, x, usar_ia=False)
from automation.agents import ScriptAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, VideoBrief, VideoItem  # noqa: E402


class _Resp:
    def __init__(self, conteudo):
        self.conteudo = conteudo

    def raise_for_status(self):
        pass

    def json(self):
        return {"message": {"content": self.conteudo}}


def _video():
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    brief = VideoBrief(
        title="A cidade subterrânea sob a Turquia",
        format="shorts",
        target_duration_seconds=30,
        sources_rationale={"research": "Tema: arqueologia. Uma cidade subterrânea foi descoberta na Capadócia."},
    )
    return VideoItem(batch_id="teste-roteirista", title=brief.title, brief=brief, agents=agentes)


def test_roteirista():
    resposta = json.dumps({
        "hook": "Uma parede derrubada revelou uma passagem que ninguém esperava encontrar.",
        "body": "Sob a Capadócia, corredores e salas formam uma cidade subterrânea. O achado mostra como comunidades buscaram abrigo e organizaram a vida abaixo do solo. A passagem começa numa casa comum e conduz a espaços escavados na rocha. Cada ambiente revela planejamento, esforço coletivo e adaptação. Sem contexto arqueológico adicional, sua datação exata continua fora deste relato. O mais importante é separar o que a descoberta mostra das interpretações que ainda precisam de confirmação cuidadosa.",
        "cta": "Inscreva-se para acompanhar outras descobertas históricas.",
        "alternative_titles": ["A cidade sob a Capadócia", "O segredo abaixo da Turquia", "Corredores de uma cidade perdida"],
        "description": "Uma viagem pelos corredores subterrâneos encontrados na Capadócia.",
        "hashtags": ["#arqueologia", "história", "turquia"],
        "tags": ["Capadócia", "Turquia", "arqueologia", "cidade subterrânea", "história"],
    }, ensure_ascii=False)
    pedidos = []

    def falso(url, json=None, timeout=None):
        pedidos.append(json)
        return _Resp(resposta)

    original = sw.httpx.post
    sw.httpx.post = falso
    try:
        video = _video()
        ScriptAgent().execute(video)
    finally:
        sw.httpx.post = original

    assert len(pedidos) == 1
    assert pedidos[0]["format"] == "json" and pedidos[0]["keep_alive"] == "2m" and "keep_alive" not in pedidos[0]["options"]
    prompt = pedidos[0]["messages"][0]["content"]
    assert "você não vai acreditar" in prompt and "Never invent" in prompt
    assert video.brief.script_hook.startswith("Uma parede")
    assert len(video.brief.alternative_titles) == 3
    assert video.brief.hashtags == ["arqueologia", "história", "turquia"]
    assert video.brief.sources_rationale["script"].startswith("Roteiro: ollama")
    assert "Você não vai acreditar" not in video.brief.script_body
    print("[OK] roteiro estruturado do Ollama aplicado ao vídeo e metadados validados")

    curta = json.dumps({
        "hook": "Uma passagem apareceu atrás da parede.", "body": "O caminho levava ao subsolo.",
        "cta": "Acompanhe a investigação.", "alternative_titles": ["A", "B", "C"],
        "description": "Descrição.", "hashtags": ["a", "b", "c"], "tags": ["a", "b", "c", "d", "e"],
    })
    corrigida = json.dumps({
        "hook": "Uma parede comum escondia uma passagem para o subsolo.",
        "body": "Pesquisadores sugerem que o espaço tinha uma função específica. A passagem conduz a corredores escavados na rocha e conecta diferentes ambientes. O conjunto mostra planejamento e esforço coletivo. Cada sala amplia as perguntas sobre quem esteve ali e como o local era utilizado. Sem outras fontes verificadas, as respostas permanecem abertas. A descoberta transforma uma casa comum no ponto de entrada para uma história muito maior.",
        "cta": "Acompanhe o canal para conhecer outras descobertas.",
        "alternative_titles": ["A passagem subterrânea", "O segredo atrás da parede", "Uma cidade sob a casa"],
        "description": "Uma passagem inesperada conduz a espaços subterrâneos.",
        "hashtags": ["arqueologia", "história", "descoberta"],
        "tags": ["arqueologia", "passagem", "subsolo", "história", "descoberta"],
    }, ensure_ascii=False)
    respostas = iter([curta, corrigida])
    pedidos_correcao = []

    def falso_correcao(url, json=None, timeout=None):
        pedidos_correcao.append(json)
        return _Resp(next(respostas))

    sw.httpx.post = falso_correcao
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert len(pedidos_correcao) == 2
    assert "pesquisadores" not in resultado["script_body"].lower()
    assert resultado.get("validation_adjustments")
    assert any("too short" in f for f in resultado["first_attempt_failures"]), resultado["first_attempt_failures"]
    print("[OK] roteiro curto é reescrito e atribuição sem fonte vira hipótese explícita")

    # Hook e CTA sem ponto final (visto no teste real): a narração precisa separar as frases para o #04 cortar as cenas
    sem_ponto = json.loads(corrigida)
    sem_ponto["hook"] = sem_ponto["hook"].rstrip(".")
    sem_ponto["body"] = sem_ponto["body"].replace("Pesquisadores sugerem que o espaço", "A passagem indica que o espaço")
    sem_ponto["cta"] = sem_ponto["cta"].rstrip(".")
    sem_ponto_json = json.dumps(sem_ponto, ensure_ascii=False)
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp(sem_ponto_json)
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert "subsolo. A passagem indica" in resultado["script_body"] and resultado["script_body"].endswith("descobertas."), resultado["script_body"]
    print("[OK] hook, corpo e CTA sem ponto final ganham pontuação na narração")

    # Ano fora do contexto (visto no teste real: "datado de cerca de 700 a.C.") força reescrita
    com_ano = dict(sem_ponto, body=sem_ponto["body"] + " O nível mais antigo seria de 700 a.C.")
    respostas = iter([json.dumps(com_ano, ensure_ascii=False), sem_ponto_json])
    pedidos_ano = []

    def falso_ano(url, json=None, timeout=None):
        pedidos_ano.append(json)
        return _Resp(next(respostas))

    sw.httpx.post = falso_ano
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Redescoberta em 1963 atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert len(pedidos_ano) == 2 and "700" not in resultado["script_body"]
    assert any("700" in f for f in resultado["first_attempt_failures"]), resultado["first_attempt_failures"]
    assert "number, year or date" in pedidos_ano[1]["messages"][0]["content"]
    print("[OK] número/ano que não está no título nem no contexto força a reescrita")

    # Autoridade sem fonte no meio da frase vira hipótese com minúscula
    meio = dict(sem_ponto, body=sem_ponto["body"].replace("A passagem indica que o espaço", "Ali, especialistas acreditam que o espaço"))
    meio_json = json.dumps(meio, ensure_ascii=False)
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp(meio_json)
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert "Ali, uma possibilidade é que o espaço" in resultado["body"], resultado["body"]
    print("[OK] atribuição sem fonte no meio da frase vira \"uma possibilidade é que\" com minúscula")

    # 1ª reescrita ainda reprovada ("Cientistas de todo o mundo…" não é neutralizável): a 2ª reescrita é aceita
    cientistas_json = json.dumps(dict(sem_ponto, body="Cientistas de todo o mundo estudam o lugar. " + sem_ponto["body"]), ensure_ascii=False)
    respostas = iter([cientistas_json, cientistas_json, sem_ponto_json])
    pedidos_duas = []

    def falso_duas(url, json=None, timeout=None):
        pedidos_duas.append(json)
        return _Resp(next(respostas))

    sw.httpx.post = falso_duas
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert len(pedidos_duas) == 3 and "cientistas" not in resultado["script_body"].lower()
    print("[OK] 1ª reescrita reprovada: a 2ª é aceita")

    # Três respostas reprovadas: desiste com erro (o agente reprova o vídeo)
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp(cientistas_json)
    try:
        sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
        raise AssertionError("deveria ter reprovado")
    except ValueError as e:
        assert "2 correções" in str(e), e
    finally:
        sw.httpx.post = original
    print("[OK] três respostas reprovadas: erro claro")

    # 1ª resposta malformada (só 2 hashtags; visto no teste real: contingência em 2 s): conta como tentativa e reescreve
    malformada = json.dumps(dict(sem_ponto, hashtags=["a", "b"]), ensure_ascii=False)
    respostas = iter([malformada, sem_ponto_json])
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp(next(respostas))
    try:
        resultado = sw.escrever_roteiro("A cidade subterrânea", "shorts", 58, "Uma passagem foi encontrada atrás de uma parede.")
    finally:
        sw.httpx.post = original
    assert any("invalid answer" in f for f in resultado["first_attempt_failures"]), resultado["first_attempt_failures"]
    print("[OK] resposta malformada vira tentativa reprovada e é reescrita")

    def falha(url, json=None, timeout=None):
        raise sw.httpx.ConnectError("Ollama fora")

    # Ollama fora: sem roteiro de contingência; o vídeo é reprovado (REJECTED) e o orquestrador não segue para o #04
    sw.httpx.post = falha
    try:
        video = _video()
        ScriptAgent().execute(video)
    finally:
        sw.httpx.post = original
    a3 = next(a for a in video.agents if a.order == 3)
    assert video.status == "REJECTED" and a3.status == "FAILED", (video.status, a3.status)
    assert "IA local indisponível (ConnectError" in a3.message and video.brief.sources_rationale["script"].startswith("Roteiro não gerado")
    assert video.brief.script_body == "" and video.brief.description == "", "nada de texto de contingência no vídeo"
    print(f"[OK] Ollama fora: vídeo reprovado sem roteiro | {a3.message}")

    # Roteiro reprovado 3 vezes pela validação: também reprova o vídeo, com o motivo
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp(cientistas_json)
    try:
        video = _video()
        ScriptAgent().execute(video)
    finally:
        sw.httpx.post = original
    a3 = next(a for a in video.agents if a.order == 3)
    assert video.status == "REJECTED" and a3.status == "FAILED" and "reprovado pela validação" in a3.message, a3.message
    assert video.brief.script_body == ""
    print("[OK] roteiro reprovado 3 vezes: vídeo reprovado, sem roteiro")

    # Orquestrador com o Roteirista de verdade e o Ollama fora: nenhum agente depois do #03 roda
    from automation.models import Batch
    from automation.orchestrator import AutomationOrchestrator
    orq, chamados = AutomationOrchestrator(), []

    class _Falso:
        def __init__(self, ordem):
            self.ordem = ordem

        def execute(self, video, *a, **k):
            chamados.append(self.ordem)

    for i, nome in enumerate(["research", "strategy", "visual", "video", "audio", "review", "design", "publish", "analytics"]):
        setattr(orq, f"agent_{nome}", _Falso(nome))
    sw.httpx.post = falha
    try:
        video = _video()
        orq._process_video_pipeline(Batch(channel_id="teste", niche="curiosidades"), video)
    finally:
        sw.httpx.post = original
    assert chamados == ["research", "strategy"] and video.status == "REJECTED", (chamados, video.status)
    print("[OK] orquestrador: com o Roteirista sem IA, o vídeo para no #03 (sem imagens, voz e render)")


if __name__ == "__main__":
    test_roteirista()
    print("TODOS OS TESTES DO ROTEIRISTA PASSARAM")
