"""Catálogo real de vídeos para a tela "Vídeos Criados".

Junta as duas origens que existem de verdade:
- **Esteira**: itens da esteira autônoma em data/automation.db (ideias, roteiros, rascunhos…).
- **LeccorTube**: projetos do motor em projects/<id>/project.json (os vídeos feitos pelo LeccorTube
  Simples ou pelo app), com MP4, miniatura e roteiro de verdade.

Nada de views/CTR/retenção: o sistema ainda não lê o YouTube Analytics, então esses campos não existem.
Publicação "real" só conta quando há um ID de vídeo do YouTube que não seja o falso "yt-<horário>" que o
Publicador (#09) gera hoje.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

from automation.storage import storage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJETOS = os.path.join(RAIZ, "projects")
_DURACOES: Dict[str, Any] = {}  # cache: caminho -> (mtime, segundos)

# status da esteira -> (chave da aba, texto, cor)
STATUS_ESTEIRA = {
    "IDEA_DISCOVERED": ("ideia", "IDEIA", "slate"), "IDEA_SCORED": ("ideia", "IDEIA AVALIADA", "slate"),
    "SCRIPT_DRAFT": ("producao", "ROTEIRO", "cyan"), "SCRIPT_APPROVED": ("producao", "ROTEIRO APROVADO", "cyan"),
    "ASSETS_GENERATING": ("producao", "GERANDO MÍDIA", "cyan"), "RENDERING": ("producao", "RENDERIZANDO", "cyan"),
    "QA_PENDING": ("producao", "EM REVISÃO", "cyan"), "DRAFT_READY": ("rascunho", "RASCUNHO PRONTO", "purple"),
    "AWAITING_APPROVAL": ("rascunho", "AGUARDANDO APROVAÇÃO", "amber"), "APPROVED": ("rascunho", "APROVADO", "purple"),
    "UPLOAD_QUEUED": ("rascunho", "NA FILA DE ENVIO", "amber"), "UPLOADING": ("rascunho", "ENVIANDO", "amber"),
    "UPLOADED_PRIVATE": ("publicado", "ENVIADO (PRIVADO)", "emerald"), "SCHEDULED": ("publicado", "AGENDADO", "amber"),
    "PUBLISHED": ("publicado", "PUBLICADO", "emerald"), "LEARNING_RECORDED": ("publicado", "PUBLICADO", "emerald"),
    "REJECTED": ("falhou", "REPROVADO", "rose"), "FAILED": ("falhou", "FALHOU", "rose"), "CANCELED": ("falhou", "CANCELADO", "rose"),
}
NOME_ETAPA = {"preview": "Prévia", "voice": "Voz", "images": "Imagens", "videos": "Clipes", "render": "Montagem",
              "export": "Exportação", "all": "Tudo", "dub": "Dublagem"}


def _url_midia(caminho: Optional[str]) -> Optional[str]:
    if caminho and os.path.isfile(caminho):
        from urllib.parse import quote
        return f"/api/abrir_arquivo?caminho={quote(caminho)}"
    return None


def _duracao(caminho: Optional[str]) -> Optional[float]:
    if not caminho or not os.path.isfile(caminho):
        return None
    mt = os.path.getmtime(caminho)
    c = _DURACOES.get(caminho)
    if c and c[0] == mt:
        return c[1]
    try:
        import ambiente  # tools/diag (no sys.path pelo simples/server.py)
        seg = round(ambiente.info(caminho)[0], 1)
    except Exception:
        seg = None
    _DURACOES[caminho] = (mt, seg)
    return seg


def _projetos() -> List[Dict[str, Any]]:
    itens = []
    if not os.path.isdir(PROJETOS):
        return itens
    for pid in os.listdir(PROJETOS):
        pj = os.path.join(PROJETOS, pid, "project.json")
        if not os.path.isfile(pj):
            continue
        try:
            with open(pj, encoding="utf-8") as f:
                p = json.load(f)
        except Exception:
            continue
        pasta = os.path.join(PROJETOS, pid)
        out = p.get("outputs") or {}
        st = p.get("status") or {}
        exp = out.get("export_dir")
        mp4_exp = None
        if exp and os.path.isdir(exp):
            mp4_exp = next((os.path.join(exp, n) for n in os.listdir(exp) if n.lower().endswith(".mp4")), None)
        mp4 = mp4_exp or (os.path.join(pasta, out["video"]) if out.get("video") else None)
        if mp4 and not os.path.isfile(mp4):
            mp4 = None
        thumb = os.path.join(pasta, out["thumbnail"]) if out.get("thumbnail") else None
        if not thumb or not os.path.isfile(thumb):
            primeira = next((s.get("image") for s in p.get("scenes", []) if s.get("image")), None)
            thumb = os.path.join(pasta, primeira) if primeira else None
        estado = st.get("state")
        if estado in ("running", "queued"):
            chave, txt, cor = "producao", f"GERANDO · {NOME_ETAPA.get(st.get('step'), st.get('step') or '').upper()}", "cyan"
        elif mp4:
            chave, txt, cor = "pronto", "VÍDEO PRONTO", "emerald"
        elif estado == "error":
            chave, txt, cor = "falhou", f"ERRO · {NOME_ETAPA.get(st.get('step'), st.get('step') or '').upper()}", "rose"
        else:
            chave, txt, cor = "rascunho", "INCOMPLETO", "purple"
        cenas = p.get("scenes") or []
        itens.append({
            "id": f"lt:{pid}", "origem": "leccortube", "origem_nome": "LeccorTube",
            "titulo": p.get("title") or pid, "canal": "LeccorTube (manual)", "canal_id": "leccortube",
            "formato": "9:16" if p.get("preset") == "short" else "16:9",
            "status": chave, "status_texto": txt, "status_cor": cor,
            "criado_em": p.get("created") or os.path.getctime(pj),
            "duracao_s": _duracao(mp4), "cenas": len(cenas), "estilo": p.get("style_id") or "",
            "miniatura": _url_midia(thumb), "video": _url_midia(mp4),
            "arquivo_video": mp4, "pasta": exp if exp and os.path.isdir(exp) else pasta,
            "roteiro": "\n\n".join(s.get("text", "") for s in cenas if s.get("text")),
            "etapa": NOME_ETAPA.get(st.get("step"), st.get("step") or ""), "mensagem": st.get("message") or "",
            "agentes": None, "youtube_url": None, "publicacao_simulada": False, "nicho": "",
        })
    return itens


def _esteira() -> List[Dict[str, Any]]:
    canais = {c.id: c for c in storage.list_channels()}
    lotes: Dict[str, Any] = {}
    itens = []
    for v in storage.list_all_videos(limit=10000):
        if v.batch_id not in lotes:
            lotes[v.batch_id] = storage.get_batch(v.batch_id)
        lote = lotes[v.batch_id]
        canal = canais.get(lote.channel_id) if lote else None
        chave, txt, cor = STATUS_ESTEIRA.get(v.status, ("rascunho", v.status, "slate"))
        pub = v.publication or {}
        yt = pub.get("youtube_video_id") or ""
        falso = bool(yt) and yt.startswith("yt-")  # ID inventado pelo Publicador antigo (antes de 20/10), sem upload real
        if falso:
            chave, txt, cor = "rascunho", "PUBLICAÇÃO SIMULADA", "amber"
        elif chave == "publicado" and not yt:  # status de publicado sem ID real do YouTube não conta
            chave, txt, cor = "rascunho", "RASCUNHO · SEM UPLOAD", "amber"
        elif pub.get("status") == "UPLOAD_UNAVAILABLE":  # Publicador recusou: upload ainda não existe
            chave, txt, cor = "rascunho", "RASCUNHO · SEM UPLOAD", "amber"
        mp4 = v.artifacts.get("video_path")
        thumb = v.artifacts.get("thumbnail_path")
        b = v.brief
        itens.append({
            "id": v.id, "origem": "esteira", "origem_nome": "Esteira",
            "titulo": v.title or b.title, "canal": canal.title if canal else "Canal removido",
            "canal_id": lote.channel_id if lote else "", "formato": "9:16" if b.format == "shorts" else "16:9",
            "status": chave, "status_texto": txt, "status_cor": cor, "criado_em": v.created_at,
            "duracao_s": _duracao(mp4), "cenas": len(b.scenes), "estilo": b.visual_style,
            "miniatura": _url_midia(thumb), "video": _url_midia(mp4), "arquivo_video": mp4 if mp4 and os.path.isfile(mp4) else None,
            "pasta": os.path.dirname(mp4) if mp4 and os.path.isfile(mp4) else None,
            "roteiro": b.script_body or "", "etapa": "", "mensagem": "",
            "agentes": {"concluidos": sum(1 for a in v.agents if a.status == "COMPLETED"), "total": len(v.agents) or 10,
                        "lista": [{"ordem": a.order, "nome": a.name, "status": a.status} for a in v.agents]},
            "youtube_url": pub.get("url") if yt and not falso else None, "publicacao_simulada": falso,
            "nicho": lote.niche if lote else "",
        })
    return itens


def catalogo() -> Dict[str, Any]:
    videos = _projetos() + _esteira()
    videos.sort(key=lambda v: v["criado_em"] or 0, reverse=True)
    agora = time.time()
    prontos = [v for v in videos if v["arquivo_video"]]
    return {
        "videos": videos,
        "resumo": {
            "total": len(videos),
            "leccortube": sum(1 for v in videos if v["origem"] == "leccortube"),
            "esteira": sum(1 for v in videos if v["origem"] == "esteira"),
            "ultimos_30_dias": sum(1 for v in videos if (v["criado_em"] or 0) > agora - 30 * 86400),
            "prontos": len(prontos),
            "duracao_total_s": round(sum(v["duracao_s"] or 0 for v in prontos)),
            "publicados_youtube": sum(1 for v in videos if v["youtube_url"]),
            "publicacoes_simuladas": sum(1 for v in videos if v["publicacao_simulada"]),
            "em_producao": sum(1 for v in videos if v["status"] == "producao"),
            "ideias": sum(1 for v in videos if v["status"] == "ideia"),
            "rascunhos": sum(1 for v in videos if v["status"] == "rascunho"),
            "falhas": sum(1 for v in videos if v["status"] == "falhou"),
        },
    }


def abrir(video_id: str, alvo: str) -> str:
    """Abre o vídeo ou a pasta dele no Windows (servidor local). Devolve o caminho aberto."""
    v = next((x for x in catalogo()["videos"] if x["id"] == video_id), None)
    if not v:
        raise KeyError(video_id)
    caminho = v["arquivo_video"] if alvo == "video" else v["pasta"]
    if not caminho or not os.path.exists(caminho):
        raise FileNotFoundError(alvo)
    os.startfile(caminho)  # noqa: S606 (abre no próprio PC do usuário)
    return caminho
