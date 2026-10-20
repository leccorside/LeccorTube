"""Testes do Diretor Visual (#04): prompts das cenas escritos pelo Ollama, com queda para o genérico.

Isolado: pasta de dados temporária; vídeo montado só na memória. Sem argumentos, os pedidos ao Ollama
são interceptados (roda sem o modelo). Com --real, chama o Ollama de verdade (precisa do qwen2.5vl:7b).

Rodar: .venv\\Scripts\\python.exe automation\\test_diretor_visual.py [--real]
"""
import os
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "tools", "diag"))

from automation.paths import isolar_para_teste  # noqa: E402

DADOS_TESTE = isolar_para_teste()

import httpx  # noqa: E402

from automation import prompt_writer as pw  # noqa: E402
from automation.agents import CreativeDirectorAgent  # noqa: E402
from automation.models import AGENTS_METADATA, AgentState, VideoBrief, VideoItem  # noqa: E402

ROTEIRO = ("Em 1987, uma menina de oito anos chamada Clara desapareceu na floresta atrás de casa. "
           "A polícia encontrou o casaco vermelho dela dobrado sobre uma cadeira, numa cabana abandonada. "
           "Na parede, escrito com letra de criança, havia uma frase: eu não estou perdida.")


def _video():
    agentes = [AgentState(order=m["order"], key=m["key"], name=m["name"]) for m in AGENTS_METADATA]
    b = VideoBrief(title="O casaco vermelho de Clara", script_body=ROTEIRO)
    return VideoItem(batch_id="teste-diretor", title=b.title, brief=b, agents=agentes)


def _agente4(v):
    return next(a for a in v.agents if a.order == 4)


class _Resp:
    def __init__(self, conteudo):
        self.conteudo = conteudo

    def raise_for_status(self):
        pass

    def json(self):
        return {"message": {"content": self.conteudo}}


def _com_ollama_falso(resposta, fn):
    pedidos = []

    def falso(url, json=None, timeout=None):
        pedidos.append(json)
        if isinstance(resposta, Exception):
            raise resposta
        return _Resp(resposta)

    original = pw.httpx.post
    pw.httpx.post = falso
    try:
        return fn(), pedidos
    finally:
        pw.httpx.post = original


def test_interceptado():
    # 1. Todas as cenas: prompts da IA, rótulos ("prompt1:", "2.") removidos, pedido único com keep_alive 0
    resp = '{"1": "prompt1: a girl in a red coat walking into a dark pine forest", "s002": "2. a red coat folded on a chair in an abandoned cabin", "3": "childish handwriting on a wooden wall, dim light"}'
    v = _video()
    _, pedidos = _com_ollama_falso(resp, lambda: CreativeDirectorAgent().execute(v))
    assert len(pedidos) == 1, f"esperava 1 pedido, foram {len(pedidos)}"
    assert pedidos[0]["keep_alive"] == 0 and pedidos[0]["format"] == "json" and "keep_alive" not in pedidos[0]["options"], pedidos[0]
    assert [s.prompt_en for s in v.brief.scenes] == ["a girl in a red coat walking into a dark pine forest",
                                                     "a red coat folded on a chair in an abandoned cabin",
                                                     "childish handwriting on a wooden wall, dim light"], [s.prompt_en for s in v.brief.scenes]
    assert "escritos pela IA" in _agente4(v).message, _agente4(v).message
    print(f"[OK] 3/3 prompts da IA, 1 pedido, keep_alive 0 no nível de cima | {_agente4(v).message}")

    # 2. Parcial: a cena sem resposta fica com o genérico e a mensagem diz quantas vieram da IA
    v = _video()
    _com_ollama_falso('{"1": "a girl in a red coat", "3": "handwriting on a wall"}', lambda: CreativeDirectorAgent().execute(v))
    assert v.brief.scenes[1].prompt_en.startswith("cinematic scene depicting"), v.brief.scenes[1].prompt_en
    assert "2/3" in _agente4(v).message, _agente4(v).message
    print(f"[OK] resposta parcial: cena 2 genérica | {_agente4(v).message}")

    # 3. Ollama fora do ar: todas genéricas, mensagem avisa, o vídeo segue
    v = _video()
    _com_ollama_falso(httpx.ConnectError("conexão recusada"), lambda: CreativeDirectorAgent().execute(v))
    assert all(s.prompt_en.startswith("cinematic scene depicting") for s in v.brief.scenes)
    assert "indisponível" in _agente4(v).message and _agente4(v).status == "COMPLETED", _agente4(v).message
    print(f"[OK] Ollama fora: prompts genéricos | {_agente4(v).message}")

    # 4. Nunca mais o prompt fixo antigo
    assert not any("cinematic dark atmospheric scene depicting" in s.prompt_en for s in v.brief.scenes)
    print("[OK] o prompt fixo antigo não aparece mais")


def test_real():
    v = _video()
    t = time.time()
    CreativeDirectorAgent().execute(v)
    seg = time.time() - t
    print(f"\n[REAL] {seg:.0f} s | {_agente4(v).message}")
    for s in v.brief.scenes:
        print(f"  cena {s.scene_index}: {s.text_pt[:60]}…\n    -> {s.prompt_en}")
    assert "escritos pela IA" in _agente4(v).message, _agente4(v).message
    assert not any(s.prompt_en.startswith("cinematic scene depicting") for s in v.brief.scenes)
    carregados = httpx.get(f"{pw.OLLAMA_URL}/api/ps", timeout=5).json().get("models", [])
    assert not carregados, f"o modelo deveria ter saído da VRAM: {carregados}"
    print("[OK] prompts reais da IA para todas as cenas e modelo fora da VRAM depois (keep_alive 0)")


if __name__ == "__main__":
    test_interceptado()
    if "--real" in sys.argv:
        test_real()
    print("\nTODOS OS TESTES DO DIRETOR VISUAL PASSARAM")
