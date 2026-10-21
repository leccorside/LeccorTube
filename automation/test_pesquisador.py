"""Testes do Pesquisador (#01): fatos da Wikipédia escolhidos pela IA local para o contexto do Roteirista (#03).

Isolado: pasta de dados temporária. Sem argumentos, a Wikipédia e o Ollama são interceptados. Com --real, busca
de verdade (precisa de internet e do qwen2.5vl:7b) e mostra os artigos escolhidos para algumas pautas.

Rodar: .venv\\Scripts\\python.exe automation\\test_pesquisador.py [--real]
"""
import json
import os
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

import httpx  # noqa: E402

from automation import agents as agents_mod  # noqa: E402
from automation import fact_research as fr  # noqa: E402
from automation import script_writer as sw  # noqa: E402
from automation import sensitive_filter as sf  # noqa: E402
from automation import topic_finder as tf  # noqa: E402

# Este teste cobre o fluxo antigo (título pronto + pesquisa de fatos); o fluxo novo por categorias e o filtro de
# temas sensíveis com IA estão em test_pautas.py
tf.categorias = lambda nicho: {}
_verificar = sf.verificar
sf.verificar = lambda t, x, usar_ia=True, timeout=60: _verificar(t, x, usar_ia=False)
from automation.agents import ResearchAgent, ScriptAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, VideoBrief, VideoItem  # noqa: E402

TURRITOPSIS = ("Turritopsis dohrnii, também conhecida como medusa imortal, é uma espécie de hidrozoário considerada "
               "biologicamente imortal. Descrita em 1883, ela pode reverter ao estágio de pólipo depois de atingir a "
               "maturidade sexual. ") * 6  # > MAX_CHARS_ARTIGO, para testar o corte no fim da frase
ENVELHECIMENTO = "O envelhecimento é o processo de mudanças graduais nos organismos ao longo do tempo. " * 4
_dumps = json.dumps  # os interceptadores recebem um argumento chamado json (como o httpx), que esconde o módulo


class _Resp:
    def __init__(self, dados):
        self.dados = dados

    def raise_for_status(self):
        pass

    def json(self):
        return self.dados


def _wiki_falsa(chamadas):
    def get(url, params=None, headers=None, timeout=None):
        chamadas.append((url, params, headers))
        lang = url.split("//")[1].split(".")[0]
        if params.get("list") == "search":
            hits = {"Medusa imortal": ["Turritopsis dohrnii", "Envelhecimento"], "Turritopsis": ["Turritopsis dohrnii"],
                    "Immortal jellyfish": ["Turritopsis dohrnii", "Stub"]}.get(params["srsearch"], [])
            return _Resp({"query": {"search": [{"title": t} for t in hits]}})
        textos = {"Turritopsis dohrnii": TURRITOPSIS, "Envelhecimento": ENVELHECIMENTO, "Stub": "Curto demais."}
        return _Resp({"query": {"pages": [{"title": t, "extract": textos[t], "fullurl": f"https://{lang}.wikipedia.org/wiki/{t.replace(' ', '_')}"}
                                          for t in params["titles"].split("|")]}})
    return get


def _ollama_falso(pedidos, notas, confere=lambda artigo: "Turritopsis" in artigo):
    def post(url, json=None, timeout=None):
        pedidos.append(json)
        texto = json["messages"][0]["content"]
        if "Name the Wikipedia articles" in texto and "Regra dos 2 Minutos" in texto:
            resp = {"subject": "a productivity rule", "pt": ["Regra dos dois minutos"], "en": []}  # sem resultado na busca falsa
        elif "Name the Wikipedia articles" in texto:
            resp = {"subject": "the immortal jellyfish that reverts to a juvenile stage", "pt": ["Medusa imortal", "Turritopsis"], "en": ["Immortal jellyfish"]}
        elif texto.startswith("Video subject:"):
            artigo = texto.split('Wikipedia article "')[1].split('"')[0]
            ok = confere(artigo)
            resp = {"article_is_about": artigo, "story_in_article": ok, "same_subject": ok}
        else:
            artigos = texto.split("Articles:\n")[1].split("\n\n")[0].split("\n")
            resp = {str(i): {"article_is_about": "x", "video_is_about": "y", "score": notas(a)} for i, a in enumerate(artigos, 1)}
        return _Resp({"message": {"content": _dumps(resp)}})
    return post


def _video():
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    b = VideoBrief(title="pendente", format="shorts", target_duration_seconds=58)
    return VideoItem(batch_id="teste-pesquisador", title=b.title, brief=b, agents=agentes)


def _interceptar(get, post, fn):
    og, op = fr.httpx.get, fr.httpx.post
    fr.httpx.get, fr.httpx.post = get, post
    try:
        return fn()
    finally:
        fr.httpx.get, fr.httpx.post = og, op


def _nota_padrao(linha):
    return 3 if "Turritopsis" in linha else 1


def test_interceptado():
    # 1. Caminho completo: buscas sugeridas, artigos com nota >= 2, esboço (< 200 letras) fora, corte em fim de frase
    wiki, ia = [], []
    r = _interceptar(_wiki_falsa(wiki), _ollama_falso(ia, _nota_padrao),
                     lambda: fr.pesquisar_fatos("O Animal Imortal que Consegue Voltar a Ser Bebê", "Biologia Inusitada"))
    assert r["artigos"] == ["pt: Turritopsis dohrnii", "en: Turritopsis dohrnii"], r["artigos"]
    assert r["fontes"] == ["https://pt.wikipedia.org/wiki/Turritopsis_dohrnii", "https://en.wikipedia.org/wiki/Turritopsis_dohrnii"]
    assert "Envelhecimento" not in r["fatos"] and "Curto demais" not in r["fatos"], "nota 1 e esboço não podem entrar"
    bloco = r["fatos"].split("\n\n")[0]
    assert bloco.startswith("[Wikipédia (pt): Turritopsis dohrnii]") and bloco.endswith("maturidade sexual."), bloco[-80:]
    assert len(bloco) <= fr.MAX_CHARS_ARTIGO + 60
    assert all(h["User-Agent"].startswith("LeccorTube/") and "https://" in h["User-Agent"] for _, _, h in wiki), "a Wikimedia exige contato no User-Agent"
    assert len(ia) == 4 and all(p["keep_alive"] == "2m" and p["format"] == "json" for p in ia), len(ia)  # sugestão, notas, 2 conferências
    assert r["assunto"].startswith("the immortal jellyfish")
    assert all(r["assunto"] in p["messages"][0]["content"] for p in ia[2:]), "a conferência compara com o assunto descrito antes"
    print(f"[OK] fatos de {len(r['artigos'])} artigos (nota 3 + conferidos), genérico e esboço descartados, corte em fim de frase, {len(wiki)} pedidos à Wikipédia")

    # 1b. Nota alta no pré-filtro, mas a conferência reprova (o caso "Voo Aeroflot 513"): fica de fora
    r = _interceptar(_wiki_falsa([]), _ollama_falso([], _nota_padrao, confere=lambda a: False),
                     lambda: fr.pesquisar_fatos("O Animal Imortal que Consegue Voltar a Ser Bebê", "Biologia Inusitada"))
    assert r["fatos"] == "" and r["pre_aprovados"] and not r["artigos"], r
    print("[OK] artigo com nota alta reprovado na conferência fica de fora")

    # 2. Nenhum artigo com nota >= 2: sem fatos (o roteiro fica só com o tema)
    r = _interceptar(_wiki_falsa([]), _ollama_falso([], lambda a: 1), lambda: fr.pesquisar_fatos("A Regra dos 2 Minutos", "Disciplina"))
    assert r["fatos"] == "" and r["artigos"] == [] and r["fontes"] == []
    print("[OK] nenhum artigo relevante: sem fatos")

    # 3. Pesquisador + Roteirista: os fatos chegam ao pedido do roteiro e as fontes à descrição
    v = _video()
    _interceptar(_wiki_falsa([]), _ollama_falso([], _nota_padrao), lambda: ResearchAgent().execute(v, "curiosidades", ""))
    a1 = next(a for a in v.agents if a.order == 1)
    assert a1.status == "COMPLETED" and "2 artigo(s) da Wikipédia" in a1.message, a1.message
    assert v.brief.research_facts and v.brief.sources_rationale["research"].startswith("Tema: ")
    assert "Confiança" not in v.brief.sources_rationale["research"]
    pedidos_roteiro = []
    roteiro = json.dumps({"hook": "Existe uma medusa que volta a ser pólipo.", "body": "Ela foi descrita em 1883. " * 20,
                          "cta": "Siga o canal.", "alternative_titles": ["a", "b", "c"], "description": "Sobre a medusa imortal.",
                          "hashtags": ["a", "b", "c"], "tags": ["a", "b", "c", "d", "e"]}, ensure_ascii=False)

    def ollama_roteiro(url, json=None, timeout=None):
        pedidos_roteiro.append(json)
        return _Resp({"message": {"content": roteiro}})

    original = sw.httpx.post
    sw.httpx.post = ollama_roteiro
    try:
        ScriptAgent().execute(v)
    finally:
        sw.httpx.post = original
    pedido = pedidos_roteiro[0]["messages"][0]["content"]
    assert "Research notes (Wikipedia summaries)" in pedido and "Turritopsis dohrnii" in pedido and "1883" in pedido
    assert v.brief.description.endswith("https://en.wikipedia.org/wiki/Turritopsis_dohrnii") and "Fontes:" in v.brief.description
    assert v.brief.sources_rationale["script"].startswith("Roteiro: ollama"), "o ano 1883 está nos fatos: não pode reprovar"
    print("[OK] fatos no pedido do Roteirista, ano dos fatos aceito e fontes na descrição")

    # 4. Wikipédia fora do ar: o agente conclui com aviso, sem fatos
    def fora(url, params=None, headers=None, timeout=None):
        raise httpx.ConnectError("sem internet")

    v = _video()
    _interceptar(fora, _ollama_falso([], _nota_padrao), lambda: ResearchAgent().execute(v, "curiosidades", ""))
    a1 = next(a for a in v.agents if a.order == 1)
    assert a1.status == "COMPLETED" and "indisponível (ConnectError)" in a1.message, a1.message
    assert v.brief.research_facts == "" and v.brief.research_sources == []
    print(f"[OK] Wikipédia fora: {a1.message}")

    # 5. 1ª pauta do sorteio sem artigo na Wikipédia: fica com a 2ª, que tem fatos
    pautas = [{"title": "A Regra dos 2 Minutos que Destrói a Procrastinação", "topic": "Disciplina"},
              {"title": "O Animal Imortal que Consegue Voltar a Ser Bebê", "topic": "Biologia Inusitada"}]
    orig_busca, orig_sample = agents_mod.youtube_client.search_trending_opportunities, agents_mod.random.sample
    agents_mod.youtube_client.search_trending_opportunities = lambda n, s="": pautas
    agents_mod.random.sample = lambda seq, k: list(seq)[:k]
    try:
        v = _video()
        _interceptar(_wiki_falsa([]), _ollama_falso([], _nota_padrao), lambda: ResearchAgent().execute(v, "curiosidades", ""))
    finally:
        agents_mod.youtube_client.search_trending_opportunities, agents_mod.random.sample = orig_busca, orig_sample
    assert v.brief.title == pautas[1]["title"] and v.brief.research_facts, v.brief.title
    assert v.brief.sources_rationale["research"].startswith("Tema: Biologia Inusitada")
    print("[OK] pauta sem artigo trocada pela seguinte do sorteio, que tem fatos")

    # 6. Nenhuma pauta tem artigo: fica com a 1ª do sorteio e avisa
    agents_mod.youtube_client.search_trending_opportunities = lambda n, s="": pautas[:1]
    try:
        v = _video()
        _interceptar(_wiki_falsa([]), _ollama_falso([], _nota_padrao), lambda: ResearchAgent().execute(v, "motivacao", ""))
    finally:
        agents_mod.youtube_client.search_trending_opportunities = orig_busca
    a1 = next(a for a in v.agents if a.order == 1)
    assert v.brief.title == pautas[0]["title"] and not v.brief.research_facts and "nenhuma das 1 pautas" in a1.message, a1.message
    print(f"[OK] sem fatos em nenhuma pauta: {a1.message}")


def test_real():
    pautas = [("O Animal Imortal que Consegue Voltar a Ser Bebê", "Biologia Inusitada"),
              ("A Fita Perdida da Estação de Rádio UVB-76", "Sinais Fantasma e Espionagem"),
              ("A Cidade Subterrânea Oculta Sob a Turquia", "Arqueologia e Cidades Secretas")]
    for titulo, tema in pautas:
        t = time.time()
        r = fr.pesquisar_fatos(titulo, tema)
        print(f"\n[REAL] {titulo} ({time.time() - t:.0f} s) -> {r['artigos']}\n  {r['fatos'][:200]}…")
        assert r["fatos"] and r["fontes"], f"esperava fatos para '{titulo}'"
    print("\n[OK] fatos reais da Wikipédia para as 3 pautas")


if __name__ == "__main__":
    test_interceptado()
    if "--real" in sys.argv:
        test_real()
    print("\nTODOS OS TESTES DO PESQUISADOR PASSARAM")
