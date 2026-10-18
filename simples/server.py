"""LeccorTube Simples — interface enxuta para gerar vídeos narrados em português.

O usuário informa título, tipo, duração, estilo visual, texto da miniatura, roteiro e o tamanho/cor da
legenda. O resto é fixo: a voz é sempre a voz oficial (tools/diag/narrar_pt.py, Chatterbox Multilingual
com assets/vozes/narrador_ptbr_ref.wav), as legendas são sempre em português e todas as cenas são
imagens animadas (sem clipes de vídeo).

Por baixo, usa a API do LeccorTube (porta 7860), que precisa estar no ar (este servidor a inicia se
não estiver). Os prompts das imagens são escritos em inglês pela IA local (Ollama).

Rodar (na raiz do projeto):  .venv\\Scripts\\python.exe -m uvicorn simples.server:app --port 7861
"""
import json
import os
import re
import subprocess
import sys
import threading
import time
import traceback
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "tools", "diag"))
import ambiente  # noqa: E402  (tools/diag/ambiente.py: loops de som ambiente e mixagem)
APP = "http://127.0.0.1:7860"
OLLAMA = "http://127.0.0.1:11434"
OLLAMA_EXE = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
MODELO_IA = "qwen2.5vl:7b"
PALAVRAS_POR_SEG = 3.2  # medido na voz oficial: ~290 palavras em ~1:31
LOG = os.path.join(RAIZ, "logs", "simples.log")
FX_VOZ = "none"  # a voz oficial sai como na referência, sem eco

# fases do botão "Gerar vídeo" e o peso de cada uma na barra geral (proporcional ao tempo típico)
FASES = [("Na fila", 0), ("Preparando", 2), ("Criando o projeto", 2),
         ("Escrevendo os prompts das imagens (IA local)", 8), ("Narrando com a voz oficial", 25),
         ("Finalizando a voz", 2), ("Gerando as imagens", 45), ("Montando o vídeo", 12), ("Exportando", 4),
         ("Adicionando o som ambiente", 2)]
TOTAL_PESO = sum(p for _, p in FASES)

# nomes em português dos estilos visuais do catálogo do app (os mesmos do static/i18n_dict.js, completados)
ESTILOS_PT = {
    "anime": "Anime clássico", "anime_cinematic": "Filme de anime", "handpainted": "Estilo Ghibli",
    "anime_dark": "Anime sombrio", "chibi": "Chibi fofo", "manga": "Nanquim de mangá",
    "pixar3d": "Filme de animação 3D", "clay": "Massinha (stop motion)", "soft3d": "Mundo de brinquedo 3D",
    "lowpoly": "3D low poly (facetado)", "diorama": "Diorama em miniatura", "cartoon": "Desenho plano",
    "stick": "Animação de palitinho", "comic": "Histórias em quadrinhos", "papercut": "Recorte de papel",
    "pixel": "Pixel art (videogame retrô)", "storybook": "Livro infantil ilustrado",
    "cinematic": "Realista cinematográfico", "documentary": "Documentário realista", "aerial": "Aérea com drone",
    "noir": "Filme noir (preto e branco)", "vintage": "Fotografia antiga", "horror_real": "Terror cinematográfico",
    "found_footage": "Filmagem encontrada (found footage)", "darkfantasy": "Fantasia sombria",
    "gothic": "Nanquim gótico", "engraving": "Gravura antiga", "painterly": "Pintura suave",
    "watercolor": "Aquarela", "oil": "Pintura a óleo", "inkwash": "Aguada de nanquim", "ukiyoe": "Xilogravura japonesa",
    "fantasyart": "Fantasia épica", "cyberpunk": "Neon cyberpunk",
}
GRUPOS_PT = {"Anime": "Anime", "3D": "3D", "Cartoon": "Desenho", "Realistic": "Realista", "Horror": "Terror", "Art": "Arte"}

TIPOS_PT = {  # tipos de vídeo do catálogo do app: (nome, descrição)
    "short": ("Short vertical (9:16)", "Vertical de 30 s a 3 min, cortes rápidos e legenda grande"),
    "mystery": ("Terror e mistério", "Contos sombrios, lendas e mistérios, ritmo lento"),
    "story": ("História curta", "História animada curta, com cortes rápidos"),
    "documentary": ("Documentário", "Explicação clara sobre história, ciência ou lugares"),
    "bedtime": ("História para dormir", "Contos suaves e aconchegantes"),
    "sleep": ("Relaxar e dormir", "Histórias calmas, voz lenta e música suave"),
    "meditation": ("Meditação", "Relaxamento, respiração guiada e natureza"),
}

# mensagens do app (inglês) -> português; a primeira regra que casar vale
def _T(minutos, segundos):
    """"0","44" -> "44 s"; "1","14" -> "1 min 14 s" """
    return f"{int(minutos)} min {int(segundos)} s" if int(minutos) else f"{int(segundos)} s"


def _n(qtd, singular, plural):
    return f"{qtd} {singular if int(qtd) == 1 else plural}"


MSGS_PT = [
    (r"Waiting in queue", "Na fila"),
    (r"Loading the natural voice model.*", "Carregando o modelo de voz (na 1ª vez baixa de 2 a 4 GB)"),
    (r"Narrated (\d+)/(\d+) scenes, about (\d+)m (\d+)s left", lambda m: f"Cena {m[1]} de {m[2]} · faltam ~{_T(m[3], m[4])}"),
    (r"Narrat\w* (\d+)/(\d+).*", lambda m: f"Narrando a cena {m[1]} de {m[2]}"),
    (r"Voice effect: .*", "Aplicando o acabamento da voz"),
    (r"Voice done.*", "Voz pronta"),
    (r"Starting ComfyUI.*", "Ligando o gerador de imagens (na 1ª vez leva ~1 min)"),
    (r"ComfyUI not running, starting it", "Ligando o gerador de imagens"),
    (r"ComfyUI is busy, waiting for it", "O gerador de imagens está ocupado; aguardando"),
    (r"Waiting for the GPU", "Aguardando a placa de vídeo"),
    (r"Generating (\d+) images?", lambda m: f"Gerando {_n(m[1], 'imagem', 'imagens')}"),
    (r"Image (\d+)/(\d+), about (\d+)m (\d+)s left", lambda m: f"Imagem {m[1]} de {m[2]} · faltam ~{_T(m[3], m[4])}"),
    (r"Image (\d+)/(\d+).*", lambda m: f"Imagem {m[1]} de {m[2]}"),
    (r"Painting.*", "Pintando as imagens"),
    (r"Animating (\d+) scenes?.*", lambda m: f"Animando {_n(m[1], 'cena', 'cenas')}"),
    (r"Body check: looking at (\d+) pictures? with people",
     lambda m: f"Conferindo os corpos em {_n(m[1], 'imagem', 'imagens')} com pessoas"),
    (r"Body check done.*", "Imagens conferidas"),
    (r"Body problems.*", "Corrigindo imagens com problemas de anatomia"),
    (r"Images done.*", "Imagens prontas"),
    (r"Images: nothing to do", "Imagens já prontas"),
    (r"Render started|Starting render", "Começando a montagem"),
    (r"Rendering the preview", "Montando a prévia"),
    (r"Rendering (\S+) / (\S+)", lambda m: f"Montando {m[1]} de {m[2]}"),
    (r"Encoding with .*", "Codificando o vídeo"),
    (r"Mixing audio", "Mixando o áudio"),
    (r"Captions: .*", "Preparando as legendas"),
    (r"Sound effects: (\d+) placed.*",
     lambda m: f"{_n(m[1], 'efeito sonoro posicionado', 'efeitos sonoros posicionados')}"),
    (r"Sound effects.*", "Efeitos sonoros"),
    (r"Effect (\d+)/(\d+)", lambda m: f"Efeito {m[1]} de {m[2]}"),
    (r"Music ready", "Música pronta"),
    (r"Render done.*|Video ready", "Vídeo montado"),
    (r"Hook and originality check", "Conferindo o gancho e a originalidade"),
    (r"Titles, thumbnails, subtitles", "Títulos, miniaturas e legendas"),
    (r"(\d+) thumbnails?", lambda m: _n(m[1], "miniatura", "miniaturas")),
    (r"Export ready", "Exportado"),
    (r"Copied to .*", "Copiado para a pasta de vídeos"),
    # erros comuns
    (r"ComfyUI did not answer in time.*", "O gerador de imagens (ComfyUI) não respondeu a tempo. Veja logs\\comfyui.log"),
    (r"ComfyUI closed while starting.*", "O gerador de imagens fechou ao iniciar. Veja logs\\comfyui.log"),
    (r"ComfyUI lost this job.*", "O gerador de imagens perdeu o trabalho (provavelmente reiniciou). Gere de novo: as cenas prontas são mantidas."),
    (r"ComfyUI did not accept the job.*", "O gerador de imagens não aceitou o trabalho (está ocupado). Espere um minuto e tente de novo."),
    (r"ComfyUI (?:was )?not found.*", "O gerador de imagens (ComfyUI) não foi encontrado. Abra a Central de Ajustes do LeccorTube."),
    (r"Voice worker did not answer in (\d+) s.*", lambda m: f"O processo de voz não respondeu em {m[1]} s"),
    (r"Voice worker stopped unexpectedly.*", "O processo de voz parou de repente. Veja logs\\voice_worker.log"),
    (r"Not enough disk space on (.*)", lambda m: f"Sem espaço em disco em {m[1]}"),
    (r".*out of memory.*", "Faltou memória na placa de vídeo. Feche outros programas e tente de novo."),
    (r"Interrupted.*", "Interrompido (o app reiniciou). Gere de novo."),
    (r"Cancel requested", "Cancelamento pedido"),
    (r"No images found.*|No images yet.*", "Nenhuma imagem encontrada. Gere as imagens primeiro."),
    (r"Render the video first.*", "Monte o vídeo primeiro."),
]
MSGS_PT = [(re.compile(rf"^{p}$", re.S), t) for p, t in MSGS_PT]
_INGLES = re.compile(r"\b(the|of|with|and|is|was|not|for|scenes?|images?|done|ready|left|about|first|see|failed|error)\b", re.I)


def traduzir(msg, erro=False):
    """Traduz uma mensagem do app. Desconhecida: progresso some (fica só a fase); erro aparece com aviso."""
    msg = (msg or "").strip()
    if not msg:
        return ""
    primeira = msg.splitlines()[0].strip()
    for rx, tr in MSGS_PT:
        m = rx.match(primeira)
        if m:
            return tr(m) if callable(tr) else tr
    if not _INGLES.search(primeira):
        return primeira  # já está em português (mensagens deste servidor) ou é só número
    return f"O LeccorTube informou (em inglês): {primeira}" if erro else ""


app = FastAPI(title="LeccorTube Simples")
TRABALHO = {"ativo": False}  # um vídeo por vez (a GPU é uma só)
TRAVA = threading.Lock()


def log(msg):
    linha = f"[{datetime.now():%H:%M:%S}] {msg}"
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(linha + "\n")
    TRABALHO.setdefault("log", []).append(linha)


def app_no_ar():
    try:
        return httpx.get(f"{APP}/api/app", timeout=3).status_code == 200
    except httpx.HTTPError:
        return False


def garantir_app():
    """Sobe o servidor do LeccorTube num processo próprio (não morre junto com este)."""
    if app_no_ar():
        return
    log("Iniciando o servidor do LeccorTube…")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    with open(os.path.join(RAIZ, "logs", "server_manual.log"), "ab") as out:
        subprocess.Popen([os.path.join(RAIZ, ".venv", "Scripts", "python.exe"), "-m", "uvicorn", "app.main:app",
                          "--host", "127.0.0.1", "--port", "7860"], cwd=RAIZ, stdout=out, stderr=out, creationflags=flags)
    for _ in range(60):
        if app_no_ar():
            return
        time.sleep(2)
    raise RuntimeError("O servidor do LeccorTube não subiu (ver logs\\server_manual.log)")


def garantir_ollama():
    try:
        httpx.get(f"{OLLAMA}/api/tags", timeout=3)
        return True
    except httpx.HTTPError:
        pass
    if not os.path.exists(OLLAMA_EXE):
        return False
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    subprocess.Popen([OLLAMA_EXE, "serve"], creationflags=flags)
    for _ in range(20):
        try:
            httpx.get(f"{OLLAMA}/api/tags", timeout=2)
            return True
        except httpx.HTTPError:
            time.sleep(1)
    return False


def api(metodo, caminho, **kw):
    try:
        r = httpx.request(metodo, f"{APP}{caminho}", timeout=120, **kw)
    except httpx.HTTPError as e:
        raise RuntimeError("Não consegui falar com o LeccorTube (porta 7860): ele pode ter fechado. "
                           f"Abra de novo pelo LeccorTube Simples.bat. ({type(e).__name__})") from e
    if r.status_code >= 400:
        try:
            detalhe = r.json().get("detail") or r.text
        except ValueError:
            detalhe = r.text
        log(f"API {metodo} {caminho}: {r.status_code} {str(detalhe)[:300]}")  # original fica no simples.log
        raise RuntimeError(f"O LeccorTube recusou o pedido ({r.status_code}). {traduzir(str(detalhe), erro=True)}")
    return r.json()


def escrever_prompts(titulo, cenas):
    """Pede à IA local um prompt de imagem em inglês para cada cena. Se falhar, usa o texto da cena."""
    if not garantir_ollama():
        log("Ollama indisponível: usando o texto das cenas como prompt")
        return {}
    linhas = "\n".join(f'{s["id"]}: {s["text"]}' for s in cenas)
    pedido = (
        "You write prompts for an image generator. The video narration is in Brazilian Portuguese.\n"
        f'Video title: "{titulo}"\n'
        "For EACH scene below write ONE English prompt (25 to 45 words) describing a single still picture that "
        "illustrates that scene: who is in it, where, what is happening, lighting and mood.\n"
        "Rules: give recurring characters the same short physical description every time (age, hair, clothes); "
        "never write names alone; no text, letters or captions in the picture; violence and injuries are only "
        "implied (shadows, silhouettes, reactions), never shown; no blood, no gore; children are never shown hurt.\n"
        'Answer ONLY with JSON: {"s001": "prompt", "s002": "prompt", ...} using exactly these ids.\n\n'
        f"Scenes:\n{linhas}"
    )
    try:
        r = httpx.post(f"{OLLAMA}/api/chat", timeout=900, json={
            "model": MODELO_IA, "stream": False, "format": "json", "keep_alive": 0,  # libera a GPU logo depois
            "options": {"temperature": 0.4, "num_ctx": 8192},
            "messages": [{"role": "user", "content": pedido}]})
        r.raise_for_status()
        dados = json.loads(r.json()["message"]["content"])
        # o modelo às vezes começa com "prompt1:" ou "s001 -"; tira esse rótulo
        prompts = {k: re.sub(r"^\s*(prompt\s*\d*|s\d{3}|scene\s*\d*)\s*[:\-–]\s*", "", v, flags=re.I).strip()
                   for k, v in dados.items() if isinstance(v, str) and v.strip()}
        log(f"IA local escreveu {len(prompts)}/{len(cenas)} prompts")
        return prompts
    except Exception as e:  # sem IA, o vídeo ainda sai: o app usa o texto da cena
        log(f"IA local falhou ({e}); usando o texto das cenas como prompt")
        return {}


def geral(t):
    """Porcentagem do vídeo inteiro (0 a 100) a partir da fase atual e do progresso dentro dela."""
    if t.get("fase") == "Pronto":
        return 100
    nomes = [n for n, _ in FASES]
    if t.get("fase") not in nomes:
        return t.get("geral_max", 0)
    i = nomes.index(t["fase"])
    feito = sum(p for _, p in FASES[:i]) + FASES[i][1] * min(1.0, max(0.0, float(t.get("progresso") or 0)))
    pct = round(100 * feito / TOTAL_PESO)
    t["geral_max"] = max(t.get("geral_max", 0), pct)  # nunca volta para trás
    return t["geral_max"]


def rodar_etapa(pid, etapa, rotulo):
    TRABALHO.update(fase=rotulo, progresso=0, mensagem="")
    api("POST", f"/api/projects/{pid}/run/{etapa}", json={})
    inicio = time.time()
    time.sleep(2)
    while True:
        st = api("GET", f"/api/projects/{pid}")["status"]
        if st.get("step") == etapa:  # antes disso o status ainda é o da etapa anterior (100%)
            TRABALHO["progresso"] = st.get("progress") or 0
        TRABALHO["mensagem"] = st.get("message") or ""
        if st.get("state") == "error":
            raise RuntimeError(f"{rotulo}: {traduzir(st.get('message'), erro=True)}")
        if st.get("state") == "done" and st.get("step") == etapa and time.time() - inicio > 3:
            log(f"{rotulo}: pronto em {(time.time() - inicio) / 60:.1f} min")
            return
        time.sleep(3)


def rodar_script(cmd, ao_ler):
    """Roda um script de tools\\diag e repassa cada linha da saída; erro se o script falhar."""
    proc = subprocess.Popen(cmd, cwd=RAIZ, env=dict(os.environ, PYTHONIOENCODING="utf-8"), stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                            creationflags=subprocess.CREATE_NO_WINDOW)
    for linha in proc.stdout:
        if "Traceback" in linha or "Error" in linha:
            log(linha.strip())
        ao_ler(linha)
    if proc.wait() != 0:
        raise RuntimeError(f"{os.path.basename(cmd[2])} falhou (ver logs\\simples.log)")


def narrar_e_revisar(pid, total, tentativas=2):
    """Narra com a voz oficial (narrar_pt.py) e revisa com o Whisper (revisar_narracao.py): corta as
    sobras depois da última palavra e narra de novo as cenas que saíram diferentes do roteiro."""
    pasta = os.path.join(RAIZ, "projects", pid)
    narrar = [os.path.join(RAIZ, "venv_voice", "Scripts", "python.exe"), "-u",
              os.path.join(RAIZ, "tools", "diag", "narrar_pt.py"), pasta, "--lang", "pt"]  # padrões = versão "C"
    revisar = [os.path.join(RAIZ, ".venv", "Scripts", "python.exe"), "-u",
               os.path.join(RAIZ, "tools", "diag", "revisar_narracao.py"), pasta]
    alvo, feitas = None, [0]
    for rodada in range(tentativas + 1):
        n = total if alvo is None else len(alvo)
        feitas[0] = 0

        def ao_narrar(linha):
            if re.match(r"s\d{3}: ", linha):
                feitas[0] += 1
                TRABALHO["progresso"] = 0.75 * feitas[0] / n if rodada == 0 else TRABALHO.get("progresso", 0)
                TRABALHO["mensagem"] = (f"Cena {feitas[0]}/{n} narrada" if rodada == 0
                                        else f"Narrando de novo {feitas[0]}/{n} cena(s) com erro")

        rodar_script(narrar + (["--cenas", ",".join(alvo)] if alvo else []), ao_narrar)
        TRABALHO["mensagem"] = "Conferindo a narração"
        res = {}

        def ao_revisar(linha):
            if re.match(r"s\d{3}: ", linha):
                feitas[0] += 1
                if rodada == 0:
                    TRABALHO["progresso"] = 0.75 + 0.25 * (feitas[0] - n) / n
            elif linha.startswith("REFAZER:"):
                res["refazer"] = [x for x in linha.split(":", 1)[1].strip().split(",") if x and x != "-"]

        rodar_script(revisar + (["--cenas", ",".join(alvo)] if alvo else []), ao_revisar)
        alvo = res.get("refazer") or []
        if not alvo:
            log("Narração conferida: todas as cenas batem com o roteiro")
            return
        log(f"Cenas diferentes do roteiro: {', '.join(alvo)}" + (" (narrando de novo)" if rodada < tentativas else ""))
    log(f"Aviso: {', '.join(alvo)} continuam diferentes do roteiro depois de {tentativas} tentativas")


def metadados_ptbr(proj, pasta):
    """O texto do app sai com modelos em inglês; grava uma versão em pt-BR ao lado."""
    texto = " ".join(s["text"] for s in proj["scenes"][:2])
    tags = re.findall(r"#\w+", proj.get("title", ""))
    conteudo = (
        f"TÍTULO\n{proj['title']}\n\nDESCRIÇÃO\n{texto}\n\n{' '.join(tags + ['#shorts'] if proj.get('preset') == 'short' else tags)}\n\n"
        "Sobre este vídeo: roteiro pesquisado e editado pelo canal. A narração usa voz sintética e as imagens "
        "são ilustrações geradas por IA.\n\nCHECKLIST DE ENVIO\n"
        "- Miniatura: thumbnail_A.jpg; B e C em \"Testar e comparar\"\n- Legendas: subtitles.srt (Studio > Legendas)\n"
        "- Conteúdo para crianças: NÃO (salvo histórias infantis)\n")
    with open(os.path.join(pasta, "youtube_metadata_ptbr.txt"), "w", encoding="utf-8") as f:
        f.write(conteudo)


class Pedido(BaseModel):
    titulo: str
    tipo: str = "short"
    duracao: int = 60  # segundos (meta; a duração real vem do roteiro narrado)
    estilo: str = "anime_dark"
    miniatura: str = ""
    roteiro: str
    legenda_tamanho: float = 7.4
    legenda_cor: str = "#ffffff"
    legenda_destaque: str = "#3cff7a"
    legenda_posicao: str = "middle"  # bottom, middle ou top (valores do app)
    ambiente: str = ""  # id de ambiente.lista() ("" = sem som ambiente)
    ambiente_volume: float = 30  # 0 a 100


def pipeline(p: Pedido):
    try:
        TRABALHO["fase"] = "Preparando"
        garantir_app()
        cat = api("GET", "/api/catalog")
        estilo = next((s for s in cat["styles"] if s["id"] == p.estilo), None)
        tipo = next((t for t in cat["types"] if t["id"] == p.tipo), None)
        if not estilo or not tipo:
            raise RuntimeError("Tipo ou estilo desconhecido")

        TRABALHO["fase"] = "Criando o projeto"
        proj = api("POST", "/api/projects", json={
            "title": p.titulo.strip(), "script": p.roteiro, "voice": "turbo:k_bm_george", "speed": 1.0,
            "scene_seconds": tipo.get("scene_seconds") or 6, "style_prefix": estilo["prefix"],
            "thumbnail_text": p.miniatura.strip(), "preset": p.tipo, "voice_fx": FX_VOZ, "voice_clean": False,
            "style_id": p.estilo, "explainer": None, "cloud": False})
        pid = proj["id"]
        TRABALHO["projeto"] = pid
        cenas = proj["scenes"]
        log(f"Projeto {pid} criado com {len(cenas)} cenas")

        TRABALHO["fase"] = "Escrevendo os prompts das imagens (IA local)"
        prompts = escrever_prompts(p.titulo, cenas)
        edits = [{"id": s["id"], "media": "image", **({"prompt": prompts[s["id"]]} if s["id"] in prompts else {})}
                 for s in cenas]
        api("PUT", f"/api/projects/{pid}/scenes", json={"scenes": edits})
        # sem a limpeza de voz do app: ela zera trechos fracos e soava como áudio "cortando"
        api("PATCH", f"/api/projects/{pid}", json={"voice_fx": FX_VOZ, "voice_clean": False, "captions": {
            "enabled": True, "size": p.legenda_tamanho, "color": p.legenda_cor, "highlight": p.legenda_destaque,
            "position": p.legenda_posicao if p.legenda_posicao in ("bottom", "middle", "top") else "middle"}})

        TRABALHO["fase"] = "Narrando com a voz oficial"
        TRABALHO["progresso"] = 0
        narrar_e_revisar(pid, len(cenas))

        rodar_etapa(pid, "voice", "Finalizando a voz")
        rodar_etapa(pid, "images", "Gerando as imagens")
        rodar_etapa(pid, "render", "Montando o vídeo")
        rodar_etapa(pid, "export", "Exportando")
        final = api("GET", f"/api/projects/{pid}")
        pasta = final["outputs"].get("export_dir") or os.path.join(RAIZ, "projects", pid, "output")
        metadados_ptbr(final, pasta)
        mp4 = next((os.path.join(pasta, n) for n in os.listdir(pasta) if n.endswith(".mp4")), None)
        if p.ambiente and p.ambiente_volume > 0 and mp4:
            TRABALHO.update(fase="Adicionando o som ambiente", progresso=0, mensagem="")
            ambiente.mixar(mp4, p.ambiente, p.ambiente_volume)
            log(f"Som ambiente: {p.ambiente} a {p.ambiente_volume:.0f}%")
        TRABALHO.update(fase="Pronto", progresso=1, pasta=pasta, video=mp4, mensagem="Vídeo pronto")
        log(f"Pronto: {mp4}")
    except Exception as e:
        TRABALHO.update(fase="Erro", erro=str(e))
        log("ERRO: " + traceback.format_exc())
    finally:
        TRABALHO["ativo"] = False
        TRABALHO["fim"] = time.time()


@app.get("/")
def pagina():
    return FileResponse(os.path.join(RAIZ, "simples", "index.html"))


@app.get("/api/opcoes")
def opcoes():
    garantir_app()
    cat = api("GET", "/api/catalog")
    return {
        "tipos": [{"id": t["id"], "nome": TIPOS_PT.get(t["id"], (t["name"],))[0],
                   "desc": TIPOS_PT.get(t["id"], ("", t.get("desc", "")))[1]}
                  for t in cat["types"] if t["id"] != "rhyme"],  # "rhyme" (música infantil cantada) não usa narração
        "estilos": [{"id": s["id"], "nome": ESTILOS_PT.get(s["id"], s["name"]),
                     "grupo": GRUPOS_PT.get(s.get("group"), s.get("group") or "Outros"),
                     "previa": APP + s["preview"] if s.get("preview") else ""} for s in cat["styles"]],
        "palavras_por_seg": PALAVRAS_POR_SEG,
        "ambientes": [{"id": i["id"], "nome": i["nome"]} for i in ambiente.lista()],
        "pasta_ambiente": ambiente.PASTA,
    }


MAX_ENVIO_MB = 50


@app.post("/api/ambiente/enviar")
async def enviar_ambiente(arquivo: UploadFile):
    """Recebe um som do usuário e guarda em assets/ambiente/ (aparece na lista de ambientes)."""
    nome, ext = os.path.splitext(os.path.basename(arquivo.filename or ""))
    if ext.lower() not in ambiente.EXT:
        raise HTTPException(400, "Envie um arquivo de áudio: " + ", ".join(ambiente.EXT))
    dados = await arquivo.read(MAX_ENVIO_MB * 1024 * 1024 + 1)
    if len(dados) > MAX_ENVIO_MB * 1024 * 1024:
        raise HTTPException(400, f"Arquivo grande demais (máximo {MAX_ENVIO_MB} MB).")
    nome = re.sub(r"[^\w\- ]+", "", nome).strip()[:60] or "meu-som"
    os.makedirs(ambiente.PASTA, exist_ok=True)
    destino, n = os.path.join(ambiente.PASTA, nome + ext.lower()), 2
    while os.path.exists(destino):  # não sobrescreve um som que já existe
        destino = os.path.join(ambiente.PASTA, f"{nome} ({n}){ext.lower()}")
        n += 1
    with open(destino, "wb") as f:
        f.write(dados)
    try:
        dur, _ = ambiente.info(destino)  # confere se o ffmpeg lê o áudio
        if dur < 1:
            raise ValueError("curto demais")
    except Exception:
        os.remove(destino)
        raise HTTPException(400, "Não consegui ler esse arquivo como áudio (ou ele tem menos de 1 s).")
    log(f"Som ambiente enviado: {os.path.basename(destino)} ({dur:.0f} s)")
    return {"id": "user:" + os.path.basename(destino), "nome": os.path.splitext(os.path.basename(destino))[0],
            "ambientes": [{"id": i["id"], "nome": i["nome"]} for i in ambiente.lista()]}


@app.get("/api/ambiente/ouvir")
def ouvir_ambiente(id: str):
    item = next((i for i in ambiente.lista() if i["id"] == id), None)
    if not item:
        raise HTTPException(404, "Som não encontrado")
    return FileResponse(item["arquivo"])


@app.post("/api/gerar")
def gerar(p: Pedido):
    if not p.titulo.strip() or not p.roteiro.strip():
        raise HTTPException(400, "Preencha o título e o roteiro.")
    with TRAVA:
        if TRABALHO.get("ativo"):
            raise HTTPException(409, "Já há um vídeo sendo gerado. Espere terminar.")
        TRABALHO.clear()
        TRABALHO.update(ativo=True, inicio=time.time(), fase="Na fila", progresso=0, log=[], titulo=p.titulo)
    threading.Thread(target=pipeline, args=(p,), daemon=True).start()
    return {"ok": True}


@app.get("/api/status")
def status():
    t = dict(TRABALHO)
    t["geral"] = geral(TRABALHO) if t.get("fase") else 0
    t["etapa"] = next((i for i, (n, _) in enumerate(FASES) if n == t.get("fase")), None)
    t["etapas"] = [n for n, p in FASES if p]
    t["mensagem"] = traduzir(t.get("mensagem"))  # as mensagens de progresso vêm do app, em inglês
    # no log da tela fica só a 1ª linha de cada registro (sem o traceback em inglês, que segue no simples.log)
    t["log"] = [linha.splitlines()[0] for linha in t.get("log", [])[-8:]]
    t["decorrido"] = int((t.get("fim") or time.time()) - t["inicio"]) if t.get("inicio") else 0
    return t


@app.post("/api/abrir")
def abrir(o: dict):
    alvo = TRABALHO.get("video") if o.get("o") == "video" else TRABALHO.get("pasta")
    if not alvo or not os.path.exists(alvo):
        raise HTTPException(404, "Nada para abrir ainda.")
    os.startfile(alvo)
    return {"ok": True}
