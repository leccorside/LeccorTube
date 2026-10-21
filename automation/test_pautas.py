"""Testes das pautas "artigo primeiro, título depois" (#01) e do filtro de temas sensíveis (#01 e #03).

Isolado: pasta de dados temporária. Sem argumentos, a Wikipédia, a API de visualizações e o Ollama são
interceptados. Com --real, gera de verdade uma pauta do nicho terror e passa artigos conhecidos pelo filtro.

Rodar: .venv\\Scripts\\python.exe automation\\test_pautas.py [--real]
"""
import json
import os
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

from automation import agents as agents_mod  # noqa: E402
from automation import fact_research as fr  # noqa: E402
from automation import script_writer as sw  # noqa: E402
from automation import sensitive_filter as sf  # noqa: E402
from automation import topic_finder as tf  # noqa: E402
from automation.agents import ResearchAgent, ScriptAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, Batch, VideoBrief, VideoItem  # noqa: E402

_dumps = json.dumps  # os interceptadores recebem um argumento chamado json (como o httpx), que esconde o módulo
LONGO = " Ela foi registrada pela primeira vez em 1912 e reaparece em relatos de várias regiões do país." * 8

# Categoria falsa "Lendas urbanas" (pt) com artigos que testam cada descarte
MEMBROS = {
    ("Categoria:Lendas urbanas", "page"): ["Lenda da loira do banheiro", "Lista de lendas urbanas", "Lendas urbanas",
                                          "Esboço curto", "Lenda já usada", "Caso proibido", "Portal:Mitos",
                                          "Capitão do filme"],
    ("Categoria:Lendas urbanas", "subcat"): ["Categoria:Lendas do Brasil"],
    ("Categoria:Lendas do Brasil", "page"): ["Corpo-seco"],
    ("Categoria:Lendas do Brasil", "subcat"): [],
}
RESUMOS = {
    "Lenda da loira do banheiro": "A loira do banheiro é uma lenda urbana brasileira sobre o fantasma de uma jovem." + LONGO,
    "Corpo-seco": "O corpo-seco é uma lenda do interior do Brasil sobre um homem rejeitado pela terra." + LONGO,
    "Esboço curto": "Texto curto demais.",
    "Lenda já usada": "Uma lenda que já virou vídeo." + LONGO,
    "Caso proibido": "Um caso de abuso infantil investigado pela polícia." + LONGO,
    "Capitão do filme": "O capitão é o vilão de uma série de filmes de piratas." + LONGO,
}
VIEWS = {"Lenda da loira do banheiro": 900, "Corpo-seco": 300, "Caso proibido": 5000, "Lenda já usada": 9999,
         "Capitão do filme": 7000}
# Categorias dos artigos (personagem de ficção x lenda que também tem categoria de ficção, como o Saci)
CATEGORIAS_ARTIGO = {
    "Capitão do filme": ["Personagens de filmes", "Vilões fictícios"],
    "Corpo-seco": ["Lendas do Brasil", "Personagens fictícios do Brasil"],
    "Lenda da loira do banheiro": ["Lendas urbanas", "Fantasmas"],
}
TEXTO_COMPLETO = ("A loira do banheiro é uma lenda urbana brasileira." + LONGO * 2 + "\n\n== Origem ==\nA história surgiu em "
                  "escolas nos anos 1980.\n\n== Ver também ==\nOutras lendas.\n\n== Referências ==\nLivro X.")


class _Resp:
    def __init__(self, dados):
        self.dados = dados

    def raise_for_status(self):
        pass

    def json(self):
        return self.dados


def _get_falso(chamadas):
    def get(url, params=None, headers=None, timeout=None):
        chamadas.append((url, params, headers))
        if "wikimedia.org/api/rest_v1/metrics/pageviews" in url:
            titulo = url.split("/user/")[1].split("/daily")[0]
            from urllib.parse import unquote
            v = VIEWS.get(unquote(titulo).replace("_", " "), 0)
            return _Resp({"items": [{"views": v // 2}, {"views": v - v // 2}]})
        if params.get("list") == "categorymembers":
            membros = MEMBROS.get((params["cmtitle"], params["cmtype"]), [])
            return _Resp({"query": {"categorymembers": [{"title": t, "ns": 100 if t.startswith("Portal:") else (14 if t.startswith("Categoria:") else 0)} for t in membros]}})
        if params.get("prop") == "categories":
            t = params["titles"]
            return _Resp({"query": {"pages": [{"title": t, "categories": [{"title": "Categoria:" + c} for c in CATEGORIAS_ARTIGO.get(t, [])]}]}})
        if params.get("prop") == "langlinks":
            return _Resp({"query": {"pages": [{"title": params["titles"], "langlinks": []}]}})
        titulos = params["titles"].split("|")
        if params.get("exintro"):
            return _Resp({"query": {"pages": [{"title": t, "extract": RESUMOS.get(t, ""), "fullurl": f"https://pt.wikipedia.org/wiki/{t.replace(' ', '_')}"} for t in titulos]}})
        return _Resp({"query": {"pages": [{"title": titulos[0], "extract": TEXTO_COMPLETO}]}})
    return get


def _post_falso(pedidos, titulos=None, fora_do_tema=()):
    titulos = list(titulos or [["A lenda da loira do banheiro nas escolas brasileiras", "Outra opção qualquer"]])

    def post(url, json=None, timeout=None):
        pedidos.append(json)
        texto = json["messages"][0]["content"]
        if texto.startswith("Video title:"):
            titulo = texto.split('"')[1]
            resp = {"problem": "", "unsupported": "inventado" in titulo}
        elif texto.startswith("A YouTube channel is about"):
            artigo = texto.split("\nArticle: ")[1].split("\n")[0]
            resp = {"article_is_about": artigo, "off_topic": artigo in fora_do_tema}
        elif texto.startswith("You screen topics"):
            resp = {"main_subject": "lenda", "blocked": False, "theme": ""}
        elif "alternative titles" in texto:
            resp = {"titles": titulos.pop(0) if titulos else ["x"]}
        else:
            raise AssertionError("pedido inesperado ao Ollama: " + texto[:80])
        return _Resp({"message": {"content": _dumps(resp, ensure_ascii=False)}})
    return post


def _interceptar(get, post, fn):
    og, op, ogt = fr.httpx.get, fr.httpx.post, tf.httpx.get
    orig_cats, orig_sample = tf.categorias, tf.random.sample
    fr.httpx.get, fr.httpx.post, tf.httpx.get = get, post, get
    tf.categorias = lambda n: {"pt": ["Lendas urbanas"]} if n == "terror" else {}
    tf.random.sample = lambda seq, k: list(seq)[:k]  # determinístico
    try:
        return fn()
    finally:
        fr.httpx.get, fr.httpx.post, tf.httpx.get = og, op, ogt
        tf.categorias, tf.random.sample = orig_cats, orig_sample


def _video(titulo="pendente", fatos=""):
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    b = VideoBrief(title=titulo, format="shorts", target_duration_seconds=58, research_facts=fatos)
    return VideoItem(batch_id="teste-pautas", title=b.title, brief=b, agents=agentes)


def test_interceptado():
    tf.marcar_usado("pt:Lenda já usada")

    # 1. Pauta: descarta lista, artigo principal da categoria, portal, esboço curto, já usado e tema sensível;
    #    entre os que sobram fica o mais visto; fatos sem títulos de seção nem "Ver também"/"Referências"
    chamadas, ia = [], []
    p = _interceptar(_get_falso(chamadas), _post_falso(ia), lambda: tf.sugerir_pauta("terror"))
    assert p["artigo"] == "pt: Lenda da loira do banheiro", p["artigo"]
    assert p["titulo"] == "A lenda da loira do banheiro nas escolas brasileiras"
    assert p["visualizacoes_30d"] == 900 and p["categoria"] == "Lendas urbanas"
    assert any("Caso proibido" in b and "abuso infantil" in b for b in p["bloqueados"]), p["bloqueados"]
    assert "== Origem ==" not in p["fatos"] and "Referências" not in p["fatos"] and "Outras lendas" not in p["fatos"], p["fatos"]
    assert p["fatos"].startswith("[Wikipédia (pt): Lenda da loira do banheiro]") and "anos 1980" in p["fatos"]
    assert p["fontes"] == ["https://pt.wikipedia.org/wiki/Lenda_da_loira_do_banheiro"]
    titulos_resumo = [t for _, prm, _ in chamadas if prm and prm.get("exintro") for t in prm["titles"].split("|")]
    for fora in ("Lista de lendas urbanas", "Lendas urbanas", "Lenda já usada", "Portal:Mitos"):
        assert fora not in titulos_resumo, f"'{fora}' não devia nem ter o resumo buscado"
    assert all(h["User-Agent"].startswith("LeccorTube/") for _, _, h in chamadas)
    assert any(x["messages"][0]["content"].startswith('A YouTube channel is about "Terror & Mistérios"') for x in ia), "checagem do tema usa o nome do nicho"
    # o mais lido ("Capitão do filme", 7.000) é personagem de ficção sem categoria de lenda: descartado sem gastar o Ollama
    assert p["ficcao"] == ["pt: Capitão do filme (Personagens de filmes)"], p["ficcao"]
    assert not any("Capitão do filme" in x["messages"][0]["content"] for x in ia)
    assert all(tf._LISTA.match(t) for t in ("Lista de lendas", "Lista das cidades mais populosas do mundo", "List of ghosts"))
    assert not tf._LISTA.match("Listas negras na história"), "só 'Lista(s) de/do/da…' no começo"
    print(f"[OK] pauta '{p['titulo']}' ({p['artigo']}, {p['visualizacoes_30d']} visualizações); bloqueado: {p['bloqueados'][0][:60]}…")

    # 1b. Artigo mais lido, mas fora do tema do nicho (o caso "Swimming" em Motivação): fica o seguinte
    p = _interceptar(_get_falso([]), _post_falso([], [["O corpo-seco: a lenda do homem rejeitado pela terra"]],
                                                  fora_do_tema=("Lenda da loira do banheiro",)),
                     lambda: tf.sugerir_pauta("terror"))
    assert p["artigo"] == "pt: Corpo-seco" and p["fora_do_tema"] == ["pt: Lenda da loira do banheiro"], p
    print("[OK] artigo fora do tema do nicho é pulado mesmo sendo o mais lido")

    # 2. Título: opções reprovadas (ano que não está no texto, caça-clique, caixa alta) -> 2º pedido; tudo reprovado -> nome do artigo
    ia = []
    ruins = [["A loira do banheiro apareceu em 1955 nas escolas", "Você não vai acreditar na loira do banheiro", "A LOIRA DO BANHEIRO ATACA DE NOVO"],
             ["A loira do banheiro: a lenda que nasceu nas escolas brasileiras"]]
    p = _interceptar(_get_falso([]), _post_falso(ia, ruins), lambda: tf.sugerir_pauta("terror"))
    assert p["titulo"] == "A loira do banheiro: a lenda que nasceu nas escolas brasileiras", p["titulo"]
    pedidos_titulo = [x for x in ia if "alternative titles" in x["messages"][0]["content"]]
    assert len(pedidos_titulo) == 2 and "1955" in pedidos_titulo[1]["messages"][0]["content"]
    p = _interceptar(_get_falso([]), _post_falso([], [["Você não vai acreditar"], ["CAIXA ALTA TOTAL AQUI"]]), lambda: tf.sugerir_pauta("terror"))
    assert p["titulo"] == "Lenda da loira do banheiro", p["titulo"]
    # título em inglês e título com afirmação sem base no texto (o caso "Bacteriófago" do Bacillus subtilis) são pulados
    p = _interceptar(_get_falso([]), _post_falso([], [["The ghost of the school bathroom legend", "Um fantasma inventado que ataca nas escolas",
                                                        "A loira do banheiro: a lenda das escolas brasileiras"]]), lambda: tf.sugerir_pauta("terror"))
    assert p["titulo"] == "A loira do banheiro: a lenda das escolas brasileiras", p["titulo"]
    # artigo só em inglês, sem título válido e sem nome em português: é pulado (não vira título em inglês)
    art_en = {"lang": "en", "titulo": "2025 Bangkok road collapse", "resumo": "x"}
    t = _interceptar(_get_falso([]), _post_falso([], [["Você não vai acreditar"], ["CAIXA ALTA TOTAL AQUI"]]),
                     lambda: tf.escrever_titulo(art_en, "A road collapsed in Bangkok in 2025." + LONGO, 30))
    assert t is None, t
    print("[OK] título: opções inválidas (formato, idioma ou sem base no texto) pedem outras; sem opção válida fica o nome do artigo")

    # 3. Pesquisador: pauta da Wikipédia vira o brief, o artigo é marcado como usado e não volta no vídeo seguinte
    v1, v2 = _video(), _video()
    _interceptar(_get_falso([]), _post_falso([]), lambda: ResearchAgent().execute(v1, "terror", ""))
    a1 = next(a for a in v1.agents if a.order == 1)
    assert a1.status == "COMPLETED" and "Pauta do artigo 'pt: Lenda da loira do banheiro'" in a1.message, a1.message
    assert v1.brief.research_facts.startswith("[Wikipédia (pt)") and v1.brief.research_sources
    assert v1.brief.sources_rationale["research"].startswith("Tema: Lendas urbanas. Wikipédia: pt: Lenda da loira do banheiro (900 visualizações")
    assert "pt:Lenda da loira do banheiro" in tf.usados()
    _interceptar(_get_falso([]), _post_falso([], [["O corpo-seco: a lenda do homem rejeitado pela terra"]]),
                 lambda: ResearchAgent().execute(v2, "terror", ""))
    assert "Corpo-seco" in v2.brief.sources_rationale["research"], "lenda com categoria de ficção (como o Saci) continua valendo"
    print(f"[OK] Pesquisador usa a pauta da Wikipédia e não repete artigo: 2º vídeo = {v2.brief.title}")

    # 4. Nicho sem categorias e subnicho personalizado: fluxo antigo (catálogo), sem chamar as categorias
    orig_busca = agents_mod.youtube_client.search_trending_opportunities
    agents_mod.youtube_client.search_trending_opportunities = lambda n, s="": [{"title": "Pauta do catálogo", "topic": "Tema X"}]
    orig_pesq = fr.pesquisar_fatos
    fr.pesquisar_fatos = lambda t, tema, timeout=120: {"fatos": "", "fontes": [], "artigos": []}
    try:
        for nicho, sub in (("saude", ""), ("terror", "casos do meu bairro")):
            v = _video()
            chamadas = []
            _interceptar(_get_falso(chamadas), _post_falso([]), lambda: ResearchAgent().execute(v, nicho, sub))
            assert v.brief.title == "Pauta do catálogo" and not [c for c in chamadas if c[1] and c[1].get("list") == "categorymembers"], (nicho, sub)
    finally:
        agents_mod.youtube_client.search_trending_opportunities = orig_busca
        fr.pesquisar_fatos = orig_pesq
    print("[OK] nicho sem categorias e subnicho personalizado usam o fluxo antigo")

    # 5. Filtro (palavras-chave, sem IA): abuso de menores bloqueia com qualquer menção; suicídio no título ou 3x no texto
    assert sf.verificar("Um filme", "Retrata abuso infantil e necrofilia.", usar_ia=False)["bloqueado"]
    assert sf.verificar("The forest", "Known for suicides. Suicide. A suicide note. Suicides.", usar_ia=False)["bloqueado"]
    assert sf.verificar("Suicídio em massa", "", usar_ia=False)["bloqueado"]
    assert not sf.verificar("Cerco de Masada", "Os defensores cometeram suicídio coletivo.", usar_ia=False)["bloqueado"]
    assert not sf.verificar("Grape harvest", "The rapeseed field and the grapes.", usar_ia=False)["bloqueado"], "'rape' só como palavra inteira"
    # tragédia real recente com menores (o caso Chibok): menores + violência na mesma frase + ano dos últimos 30 anos
    chibok = "On 14 April 2014, 276 schoolgirls were kidnapped from a school in Chibok, Nigeria, by Boko Haram."
    assert sf.verificar("Chibok schoolgirls kidnapping", chibok, usar_ia=False)["bloqueado"]
    assert sf.verificar("Massacre de Realengo", "Em 2011, um atirador matou doze alunos. Os alunos foram assassinados na escola.", usar_ia=False)["bloqueado"]
    assert not sf.verificar("Flautista de Hamelin", "Em 1284, as crianças da cidade desapareceram seguindo o flautista.", usar_ia=False)["bloqueado"], "lenda antiga passa"
    assert not sf.verificar("Navio Vasa", "Afundou em 1628. Em 1961 foi resgatado; nenhuma criança estava a bordo.", usar_ia=False)["bloqueado"], "sem violência na frase dos menores"
    assert "2014" not in sf._temas_ia() and str(__import__("datetime").date.today().year - sf.ANOS_RECENTES) in sf._temas_ia()
    print("[OK] filtro por palavras-chave: bloqueia abuso/suicídio central e tragédia recente com menores; libera menção única, 'rapeseed' e lenda antiga")

    # 6. Roteirista: pauta sensível é reprovada antes de qualquer pedido de roteiro; roteiro com termo proibido também
    v = _video("Um filme sérvio", "[Wikipédia] Um filme com cenas de abuso infantil.")
    pedidos = []
    original = sw.httpx.post
    sw.httpx.post = lambda url, json=None, timeout=None: pedidos.append(json)
    try:
        ScriptAgent().execute(v)
    finally:
        sw.httpx.post = original
    a3 = next(a for a in v.agents if a.order == 3)
    assert v.status == "REJECTED" and a3.status == "BLOCKED" and not pedidos and "tema sensível" in a3.message, a3.message
    roteiro = _dumps({"hook": "Uma lenda antiga.", "body": "A história fala de estupro e vingança. " * 15, "cta": "Siga o canal.",
                      "alternative_titles": ["a", "b", "c"], "description": "d", "hashtags": ["a", "b", "c"], "tags": ["a", "b", "c", "d", "e"]},
                     ensure_ascii=False)
    v = _video("A lenda do vale", "")
    sw.httpx.post = lambda url, json=None, timeout=None: _Resp({"message": {"content": roteiro}})
    orig_ia = sf.verificar
    sf.verificar = lambda t, x, usar_ia=True, timeout=60: orig_ia(t, x, usar_ia=False)  # sem Ollama no teste
    try:
        ScriptAgent().execute(v)
    finally:
        sw.httpx.post, sf.verificar = original, orig_ia
    assert v.status == "REJECTED" and "no roteiro" in v.brief.sources_rationale["script"], v.brief.sources_rationale["script"]
    print("[OK] Roteirista reprova pauta sensível (sem gastar o Ollama) e roteiro com termo proibido")

    # 7. Orquestrador: vídeo reprovado no #03 não passa para os agentes #04 a #10
    from automation.orchestrator import AutomationOrchestrator
    orq = AutomationOrchestrator()
    chamados = []

    class _Falso:
        def __init__(self, ordem, reprova=False):
            self.ordem, self.reprova = ordem, reprova

        def execute(self, video, *a, **k):
            chamados.append(self.ordem)
            if self.reprova:
                video.status = "REJECTED"

    for i, nome in enumerate(["research", "strategy", "script", "visual", "video", "audio", "review", "design", "publish", "analytics"], 1):
        setattr(orq, f"agent_{nome}", _Falso(i, reprova=(i == 3)))
    orq._process_video_pipeline(Batch(channel_id="teste", niche="terror"), _video())
    assert chamados == [1, 2, 3], chamados
    print("[OK] orquestrador para o vídeo reprovado depois do #03")

    # 8. Artigo com poucos fatos no texto completo (< 1.000 letras) é pulado: fica o próximo candidato
    global TEXTO_COMPLETO
    original_texto = TEXTO_COMPLETO
    TEXTO_COMPLETO = "Texto completo curto demais."
    try:
        p = _interceptar(_get_falso([]), _post_falso([], [["O corpo-seco: a lenda do homem rejeitado pela terra"]] * 3),
                         lambda: tf.sugerir_pauta("terror"))
    except ValueError as e:
        p = {"erro": str(e)}
    finally:
        TEXTO_COMPLETO = original_texto
    assert "erro" in p and "nenhum dos" in p["erro"], p  # no teste todos os textos completos são o mesmo texto curto
    print("[OK] artigo com menos de 1.000 letras de fatos é pulado")


def test_real():
    t = time.time()
    p = tf.sugerir_pauta("terror")
    print(f"\n[REAL] terror ({time.time() - t:.0f} s): {p['artigo']} ({p['categoria']}, {p['visualizacoes_30d']} visualizações)\n"
          f"  título: {p['titulo']}\n  fatos: {len(p['fatos'])} letras | bloqueados: {p['bloqueados']}")
    assert p["fatos"] and p["fontes"] and len(p["fatos"]) > 1300, "fatos devem vir do texto completo (> 1.200 letras do exchars)"
    from automation.fact_research import _wiki
    for lang, art, bloquear in (("pt", "Srpski film", True), ("en", "Suicide forest", True), ("en", "Mary Celeste", False)):
        pg = _wiki(lang, {"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "redirects": 1, "titles": art}, 20)["query"]["pages"][0]
        r = sf.verificar(pg["title"], pg.get("extract", ""))
        assert r["bloqueado"] == bloquear, (art, r)
        print(f"  filtro: {pg['title']} -> {'bloqueado (' + r['motivo'] + ')' if r['bloqueado'] else 'liberado'}")
    print("[OK] pauta real do nicho terror e filtro com artigos reais")


if __name__ == "__main__":
    test_interceptado()
    if "--real" in sys.argv:
        test_real()
    print("\nTODOS OS TESTES DAS PAUTAS PASSARAM")
