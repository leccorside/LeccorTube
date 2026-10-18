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
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "http://127.0.0.1:7860"
OLLAMA = "http://127.0.0.1:11434"
OLLAMA_EXE = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
MODELO_IA = "qwen2.5vl:7b"
PALAVRAS_POR_SEG = 3.2  # medido na voz oficial: ~290 palavras em ~1:31
LOG = os.path.join(RAIZ, "logs", "simples.log")
FX_VOZ = "none"  # a voz oficial sai como na referência, sem eco

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
    r = httpx.request(metodo, f"{APP}{caminho}", timeout=120, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"{metodo} {caminho}: {r.status_code} {r.text[:300]}")
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


def rodar_etapa(pid, etapa, rotulo):
    TRABALHO["fase"] = rotulo
    api("POST", f"/api/projects/{pid}/run/{etapa}", json={})
    inicio = time.time()
    time.sleep(2)
    while True:
        st = api("GET", f"/api/projects/{pid}")["status"]
        TRABALHO["progresso"] = st.get("progress") or 0
        TRABALHO["mensagem"] = st.get("message") or ""
        if st.get("state") == "error":
            raise RuntimeError(f"{rotulo}: {st.get('message')}")
        if st.get("state") == "done" and st.get("step") == etapa and time.time() - inicio > 3:
            log(f"{rotulo}: pronto em {(time.time() - inicio) / 60:.1f} min")
            return
        time.sleep(3)


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
            "thumbnail_text": p.miniatura.strip(), "preset": p.tipo, "voice_fx": FX_VOZ, "voice_clean": True,
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
        api("PATCH", f"/api/projects/{pid}", json={"voice_fx": FX_VOZ, "captions": {
            "enabled": True, "size": p.legenda_tamanho, "color": p.legenda_cor, "highlight": p.legenda_destaque,
            "position": p.legenda_posicao if p.legenda_posicao in ("bottom", "middle", "top") else "middle"}})

        TRABALHO["fase"] = "Narrando com a voz oficial"
        TRABALHO["progresso"] = 0
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        cmd = [os.path.join(RAIZ, "venv_voice", "Scripts", "python.exe"), "-u",
               os.path.join(RAIZ, "tools", "diag", "narrar_pt.py"), os.path.join(RAIZ, "projects", pid),
               "--lang", "pt", "--temperature", "0.7"]
        proc = subprocess.Popen(cmd, cwd=RAIZ, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace", creationflags=subprocess.CREATE_NO_WINDOW)
        feitas = 0
        for linha in proc.stdout:
            if re.match(r"s\d{3}: ", linha):
                feitas += 1
                TRABALHO["progresso"] = feitas / max(1, len(cenas))
                TRABALHO["mensagem"] = f"Cena {feitas}/{len(cenas)} narrada"
            elif "pronto:" in linha or "Traceback" in linha or "Error" in linha:
                log(linha.strip())
        if proc.wait() != 0:
            raise RuntimeError("A narração falhou (ver logs\\simples.log)")

        rodar_etapa(pid, "voice", "Finalizando a voz")
        rodar_etapa(pid, "images", "Gerando as imagens")
        rodar_etapa(pid, "render", "Montando o vídeo")
        rodar_etapa(pid, "export", "Exportando")
        final = api("GET", f"/api/projects/{pid}")
        pasta = final["outputs"].get("export_dir") or os.path.join(RAIZ, "projects", pid, "output")
        metadados_ptbr(final, pasta)
        mp4 = next((os.path.join(pasta, n) for n in os.listdir(pasta) if n.endswith(".mp4")), None)
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
        "tipos": [{"id": t["id"], "nome": t["name"]} for t in cat["types"] if t["id"] != "rhyme"],
        "estilos": [{"id": s["id"], "nome": s["name"]} for s in cat["styles"]],
        "palavras_por_seg": PALAVRAS_POR_SEG,
    }


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
    t["log"] = t.get("log", [])[-8:]
    t["decorrido"] = int((t.get("fim") or time.time()) - t["inicio"]) if t.get("inicio") else 0
    return t


@app.post("/api/abrir")
def abrir(o: dict):
    alvo = TRABALHO.get("video") if o.get("o") == "video" else TRABALHO.get("pasta")
    if not alvo or not os.path.exists(alvo):
        raise HTTPException(404, "Nada para abrir ainda.")
    os.startfile(alvo)
    return {"ok": True}
