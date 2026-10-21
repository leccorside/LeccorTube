"""Catálogo real dos 10 agentes e dos modelos/serviços que eles usam (tela Agentes & Modelos).

Tudo aqui vem do sistema de verdade: o código dos agentes (automation/agents.py), o adaptador de
vídeo, o config.json do motor, a cota do YouTube e checagens rápidas dos serviços locais (motor 7860,
ComfyUI 8188, Ollama 11434, GPU via nvidia-smi). Nenhum número é inventado: quando um agente ainda é
simulado no código, o catálogo diz isso em `implementacao` e explica em `limitacao`.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

import httpx

from automation.models import AGENTS_METADATA
from automation.quota_guard import quota_guard
from automation.video_adapter import MODELO_IA, OLLAMA_URL, APP_URL
from automation.youtube_client import youtube_client

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMFY_URL = "http://127.0.0.1:8188"
HF_HUB = os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")

CATEGORIAS = {"texto": "Criação & Texto", "visual": "Visual & Render", "audio": "Áudio & Voz",
              "qa": "Qualidade, Publicação & Análise"}


def _config() -> Dict[str, Any]:
    try:
        with open(os.path.join(RAIZ, "config.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _medir(fn):
    """Roda a checagem e devolve (resultado, ms); erro vira {'online': False}."""
    t0 = time.perf_counter()
    try:
        r = fn()
    except Exception as e:  # serviço fora do ar ou lento
        r = {"online": False, "erro": type(e).__name__}
    r["latencia_ms"] = round((time.perf_counter() - t0) * 1000)
    return r


def _motor():
    d = httpx.get(f"{APP_URL}/api/app", timeout=2).json()
    return {"online": True, "detalhe": f"{d.get('name', 'LeccorTube')} {d.get('version', '')}".strip()}


def _comfy():
    d = httpx.get(f"{COMFY_URL}/system_stats", timeout=2).json()
    dev = (d.get("devices") or [{}])[0]
    return {"online": True, "detalhe": dev.get("name", "").split(" : ")[0].replace("cuda:0 ", "") or "ComfyUI",
            "vram_total": dev.get("vram_total"), "vram_livre": dev.get("vram_free")}


def _ollama():
    tags = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=2).json().get("models", [])
    try:
        carregados = [m.get("name") for m in httpx.get(f"{OLLAMA_URL}/api/ps", timeout=2).json().get("models", [])]
    except Exception:
        carregados = []
    nomes = [m.get("name") for m in tags]
    presente = any(n.startswith(MODELO_IA) for n in nomes)
    return {"online": True, "modelos": [{"nome": m.get("name"), "gb": round((m.get("size") or 0) / 1e9, 1)} for m in tags],
            "modelo_presente": presente, "carregados": carregados,
            "detalhe": f"{MODELO_IA} instalado" if presente else f"sem o {MODELO_IA} ({len(nomes)} modelo(s))"}


def _gpu():
    out = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.used,memory.total,temperature.gpu,utilization.gpu",
                          "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=4,
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    nome, usado, total, temp, uso = [x.strip() for x in out.stdout.strip().splitlines()[0].split(",")]
    return {"online": True, "detalhe": nome, "vram_usada_mb": int(usado), "vram_total_mb": int(total),
            "temperatura_c": int(temp), "uso_pct": int(uso)}


def _hf(repo: str) -> bool:
    return os.path.isdir(os.path.join(HF_HUB, "models--" + repo.replace("/", "--")))


def _chatterbox():
    import vozes  # tools/diag (o simples/server.py já põe a pasta no sys.path)
    ok = os.path.exists(os.path.join(RAIZ, "venv_voice", "Scripts", "python.exe")) and _hf("ResembleAI/chatterbox")
    lista = vozes.lista()
    return {"online": ok, "detalhe": f"{len(lista)} voz(es) de referência", "vozes": [v["nome"] for v in lista]}


def _whisper():
    ok = _hf("Systran/faster-whisper-small")
    return {"online": ok, "detalhe": "faster-whisper small · CPU int8" if ok else "modelo não baixado"}


def _youtube():
    q = quota_guard.get_status()
    try:
        from automation.storage import storage
        from automation.youtube_oauth import oauth_service
        canais = storage.list_channels()
        # o campo is_authenticated do canal nasce True por padrão; quem sabe se há token de verdade é o OAuth
        conectados = sum(1 for c in canais if oauth_service.is_channel_authenticated(c.id))
        total = len(canais)
    except Exception:
        conectados, total = 0, 0
    return {"online": True, "detalhe": f"{conectados}/{total} canal(is) autorizado(s)", "cota": q,
            "chave_api": bool(getattr(youtube_client, "api_key", None)), "canais_conectados": conectados,
            "canais_total": total}


SERVICOS = {
    "motor": ("Motor LeccorTube", "7860", _motor),
    "comfy": ("ComfyUI", "8188", _comfy),
    "ollama": ("Ollama", "11434", _ollama),
    "gpu": ("GPU NVIDIA", "nvidia-smi", _gpu),
    "chatterbox": ("Chatterbox pt-BR", "venv_voice", _chatterbox),
    "whisper": ("Whisper", "CPU", _whisper),
    "youtube": ("YouTube Data API", "v3", _youtube),
}


def servicos() -> Dict[str, Any]:
    with ThreadPoolExecutor(max_workers=len(SERVICOS)) as ex:
        futuros = {k: ex.submit(_medir, fn) for k, (_, _, fn) in SERVICOS.items()}
        res = {k: f.result() for k, f in futuros.items()}
    for k, (nome, porta, _) in SERVICOS.items():
        res[k].update(nome=nome, porta=porta)
    return res


def _agentes(cfg: Dict[str, Any], sv: Dict[str, Any]) -> List[Dict[str, Any]]:
    chave = sv["youtube"].get("chave_api")
    w, h = cfg.get("image_width", "?"), cfg.get("image_height", "?")
    enc = cfg.get("encoder", "auto")
    vozes_n = len(sv["chatterbox"].get("vozes", []))
    cota = "100 un. de cota por busca" if chave else "Sem custo (catálogo local)"
    a = {
        1: dict(categoria="texto", implementacao="parcial", servico="youtube",
                motor="YouTube Data API v3 · search.list" if chave else "Catálogo fixo de pautas por nicho",
                motor_tag="YouTube API" if chave else "Sem chave de API",
                params=[("Região", "BR"), ("Idioma", "pt"), ("Resultados", "6")], custo=cota,
                faz="Busca vídeos públicos do nicho na API do YouTube (quando há chave) e escolhe uma pauta.",
                limitacao="A escolha da pauta é aleatória entre os resultados; sem chave de API, sorteia de uma lista fixa de títulos por nicho."
                + ("" if chave else " Hoje não há chave da API configurada.")),
        2: dict(categoria="texto", implementacao="simulado", servico=None, motor="Regras fixas (sem IA)",
                motor_tag="Sem modelo", params=[("Shorts", "58 s"), ("Longos", "180 s"), ("Score", "aleatório")],
                custo="Sem custo", faz="Define o formato (Shorts ou longo) e a duração alvo a partir das preferências do canal.",
                limitacao="O \"Opportunity Score\" é um número aleatório entre 84 e 96; não há cálculo de CTR nem de retenção."),
        3: dict(categoria="texto", implementacao="real", servico="ollama", motor=f"Ollama · {MODELO_IA}",
                motor_tag="IA local", params=[("Temp", "0.55"), ("Contexto", "8192"), ("Idioma", "pt-BR")],
                custo="Local · sem custo", faz="Escreve roteiro original, gancho, CTA, títulos alternativos, descrição, hashtags e tags em JSON validado.",
                limitacao="Usa apenas o contexto recebido do Pesquisador; sem pesquisa factual suficiente, não deve inventar dados. Se o Ollama falhar, usa uma contingência curta e sinaliza isso no vídeo."),
        4: dict(categoria="visual", implementacao="parcial", servico="ollama", motor=f"Ollama · {MODELO_IA}",
                motor_tag="IA local", params=[("Temp", "0.4"), ("Estilo", "anime_dark"), ("Pedido", "1 p/ todas")],
                custo="Local · sem custo",
                faz="Corta o roteiro em cenas e pede à IA local, num pedido só, um prompt em inglês para cada cena "
                    "(personagens com a mesma descrição, sem texto na imagem, violência só sugerida).",
                limitacao="O corte das cenas é por ponto final e o estilo é sempre anime_dark. Se o Ollama falhar, as cenas "
                          "recebem um prompt genérico e a mensagem do agente avisa."),
        5: dict(categoria="visual", implementacao="real", servico="comfy", motor="Motor LeccorTube + ComfyUI",
                motor_tag="GPU local", params=[("Imagem", f"{w}x{h}"), ("Workflow", str(cfg.get("workflow_file", "?")).replace("_api.json", "")),
                                               ("Encoder", "NVENC" if enc in ("auto", "nvenc", "h264_nvenc") else enc)],
                custo="Local · energia da GPU", faz="Cria o projeto no motor (7860), gera as imagens no ComfyUI e renderiza o vídeo com legendas.",
                limitacao="Só imagens animadas (sem clipes de vídeo). Uma geração por vez na GPU."),
        6: dict(categoria="audio", implementacao="parcial", servico="chatterbox", motor="Chatterbox Multilingual + Whisper small",
                motor_tag="Voz local", params=[("Exag.", "0.4"), ("CFG", "0.3"), ("Temp", "0.5")],
                custo="Local · sem custo", faz=f"Narração em pt-BR com {vozes_n} voz(es) de referência, revisão pelo Whisper e som ambiente a −18 LUFS.",
                limitacao="A narração, a revisão e o som ambiente rodam dentro do Produtor (#05); este agente só registra a etapa."),
        7: dict(categoria="qa", implementacao="simulado", servico=None, motor="Checklist fixo", motor_tag="Sem verificação",
                params=[("Legendas", "não checa"), ("Áudio", "não checa"), ("Resultado", "aprova")], custo="Sem custo",
                faz="Registra um checklist de qualidade no vídeo.",
                limitacao="Aprova sempre: todos os itens do checklist vêm marcados como OK, sem nenhuma verificação real."),
        8: dict(categoria="visual", implementacao="parcial", servico="motor", motor="Regra de texto + miniaturas do motor",
                motor_tag="Sem IA", params=[("Variantes", "3 (A/B/C)"), ("Texto", "≤ 24 letras"), ("Palavras", "3")],
                custo="Local · sem custo", faz="Define o texto da miniatura; o motor gera as 3 variantes no Export.",
                limitacao="O texto é só as 3 primeiras palavras do título em maiúsculas, sem IA."),
        9: dict(categoria="qa", implementacao="simulado", servico="youtube", motor="YouTube Data API v3 · videos.insert",
                motor_tag="SEM UPLOAD", params=[("Privacidade", "private"), ("Cota", "não usa"), ("Upload", "bloqueado")],
                custo="Sem custo (nada é enviado)",
                faz="No modo assistido, deixa o vídeo aguardando aprovação. No automático, tenta enviar e, sem upload, deixa o vídeo como rascunho local.",
                limitacao="O upload para o YouTube ainda não existe. O agente não marca mais o vídeo como \"Publicado\", não inventa ID e não desconta cota: avisa e guarda o vídeo como rascunho local."),
        10: dict(categoria="qa", implementacao="simulado", servico=None, motor="Valores fixos", motor_tag="Sem dados reais",
                 params=[("Retenção", "74,2% fixo"), ("CTR", "8,6% fixo"), ("Coleta", "não faz")], custo="Sem custo",
                 faz="Deveria medir retenção e CTR e realimentar o Pesquisador. Só roda para vídeos publicados de verdade (hoje, nenhum).",
                 limitacao="Sem vídeo publicado, só avisa \"nada para medir\" e não mexe no status. Quando houver publicação, ainda devolve números fixos: não consulta o YouTube Analytics."),
    }
    if not sv["ollama"].get("modelo_presente", True):  # Ollama sem o modelo: os prompts caem no genérico
        a[4]["limitacao"] = (f"O modelo {MODELO_IA} não está instalado no Ollama: as cenas ficam com prompt genérico. "
                             f"Para instalar: ollama pull {MODELO_IA}. ") + a[4]["limitacao"]
    codigo = {1: "ResearchAgent", 2: "StrategyAgent", 3: "ScriptAgent", 4: "CreativeDirectorAgent", 5: "VideoProducerAgent",
              6: "AudioEngineerAgent", 7: "QualityControlAgent", 8: "DesignerAgent", 9: "PublishingAgent", 10: "AnalyticsAgent"}
    lista = []
    for meta in AGENTS_METADATA:
        d = a[meta["order"]]
        sv_d = sv.get(d["servico"]) if d["servico"] else None
        online = None if sv_d is None else bool(sv_d.get("online"))
        if d["servico"] == "ollama" and online:
            online = bool(sv_d.get("modelo_presente"))
        lista.append({
            "ordem": meta["order"], "chave": meta["key"], "nome": meta["name"], "descricao": meta["description"],
            "categoria": d["categoria"], "categoria_nome": CATEGORIAS[d["categoria"]],
            "implementacao": d["implementacao"], "motor": d["motor"], "motor_tag": d["motor_tag"],
            "parametros": [{"rotulo": r, "valor": v} for r, v in d["params"]], "custo": d["custo"],
            "faz": d["faz"], "limitacao": d["limitacao"], "codigo": f"automation/agents.py · {codigo[meta['order']]}",
            "servico": d["servico"], "servico_online": online,
        })
    return lista


def _implementacoes() -> List[str]:
    """Real/parcial/simulado de cada agente, sem checar os serviços (o selo não depende deles)."""
    stub = {k: {} for k in SERVICOS}
    stub["youtube"] = {"chave_api": bool(getattr(youtube_client, "api_key", None))}
    stub["ollama"] = {"modelo_presente": True}
    return [a["implementacao"] for a in _agentes(_config(), stub)]


def resumo_menu_agentes():
    """(agentes com motor real ou parcial, total) — usado no selo de status da Esteira."""
    impl = _implementacoes()
    return sum(1 for i in impl if i != "simulado"), len(impl)


def resumo_menu() -> Dict[str, Any]:
    """Dados leves para o menu lateral compartilhado (sem checar os serviços lentos)."""
    impl = _implementacoes()
    with ThreadPoolExecutor(max_workers=2) as ex:  # GPU e motor em paralelo (motor fora do ar = ~1 s)
        f_gpu = ex.submit(_medir, _gpu)
        f_motor = ex.submit(_medir, lambda: {"online": httpx.get(f"{APP_URL}/api/app", timeout=1).status_code == 200})
        gpu, motor = f_gpu.result(), f_motor.result()
    try:  # mesmo total da tela Vídeos Criados (esteira + projetos do LeccorTube)
        from automation.videos_catalog import catalogo as catalogo_videos
        videos = catalogo_videos()["resumo"]["total"]
    except Exception:
        videos = None
    return {"agentes_reais": impl.count("real"), "agentes_parciais": impl.count("parcial"), "agentes_total": len(impl),
            "videos": videos, "gpu": gpu, "motor": motor}


def catalogo() -> Dict[str, Any]:
    cfg = _config()
    sv = servicos()
    agentes = _agentes(cfg, sv)
    cont = {k: sum(1 for a in agentes if a["implementacao"] == k) for k in ("real", "parcial", "simulado")}
    try:
        disco = shutil.disk_usage(RAIZ)
        disco_d = {"livre_gb": round(disco.free / 1e9, 1), "total_gb": round(disco.total / 1e9, 1)}
    except Exception:
        disco_d = None
    locais = [k for k in ("motor", "comfy", "ollama", "gpu", "chatterbox", "whisper")]
    return {
        "gerado_em": time.time(),
        "agentes": agentes,
        "categorias": [{"id": k, "nome": v, "total": sum(1 for a in agentes if a["categoria"] == k)} for k, v in CATEGORIAS.items()],
        "resumo": {**cont, "total": len(agentes),
                   "servicos_online": sum(1 for k in locais if sv[k].get("online")), "servicos_total": len(locais)},
        "servicos": sv,
        "modelo_prompts": MODELO_IA,
        "disco": disco_d,
        "politicas": [
            {"nome": "Ollama libera a VRAM depois dos prompts", "ativa": True,
             "detalhe": "O Simples usa keep_alive: 0; a esteira mantém o modelo entre as cenas e o descarrega antes do ComfyUI."},
            {"nome": "Limpeza de voz do motor desligada", "ativa": True, "detalhe": "Evita cortes no começo das frases (voice_clean = false)."},
            {"nome": "Revisão da narração pelo Whisper", "ativa": True, "detalhe": "Corta sobras do Chatterbox e refaz cenas diferentes do roteiro."},
            {"nome": "Teto diário de cota do YouTube", "ativa": True,
             "detalhe": f"Bloqueia novas chamadas ao chegar em {sv['youtube'].get('cota', {}).get('daily_limit', 10000):,} unidades.".replace(",", ".")},
            {"nome": "Publicação real no YouTube", "ativa": False,
             "detalhe": "Upload ainda não implementado: o Publicador (#09) guarda o vídeo como rascunho local, sem marcar como publicado e sem gastar cota."},
        ],
    }
