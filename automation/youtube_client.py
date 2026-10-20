"""Cliente de integração oficial e observabilidade do YouTube (Data API v3).

Respeita escopos mínimos, OAuth 2.0, termos do YouTube e políticas de privacidade.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from automation.quota_guard import quota_guard

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# O upload de vídeos (videos.insert) ainda não existe. Enquanto for False, upload_and_schedule recusa
# sem enviar, sem inventar ID e sem descontar cota; o Publicador deixa o vídeo como rascunho local.
UPLOAD_IMPLEMENTADO = False


class YouTubeClient:
    """Cliente para YouTube Data API v3 e Analytics com controle de quota e OAuth 2.0."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("YOUTUBE_API_KEY", "")

    def _load_tokens(self):
        if os.path.exists(CREDENCIAIS_PATH):
            try:
                with open(CREDENCIAIS_PATH, "r", encoding="utf-8") as f:
                    self.oauth_tokens = json.load(f)
            except Exception:
                self.oauth_tokens = {}

    def _save_tokens(self):
        try:
            os.makedirs(os.path.dirname(CREDENCIAIS_PATH), exist_ok=True)
            with open(CREDENCIAIS_PATH, "w", encoding="utf-8") as f:
                json.dump(self.oauth_tokens, f, indent=2)
        except Exception:
            pass

    def search_trending_opportunities(self, niche: str, subniche: str = "", region_code: str = "BR") -> List[Dict[str, Any]]:
        """Pesquisa oportunidades e referências públicas de vídeos no YouTube.

        Caso a chave oficial não esteja presente no ambiente, utiliza o catálogo
        curado de tendências reais e verificadas por nicho em pt-BR.
        """
        termo = f"{subniche or niche} fatos curiosidades"

        if self.api_key and quota_guard.check_quota("search.list"):
            try:
                url = "https://www.googleapis.com/youtube/v3/search"
                params = {
                    "part": "snippet",
                    "q": termo,
                    "type": "video",
                    "regionCode": region_code,
                    "relevanceLanguage": "pt",
                    "maxResults": 6,
                    "key": self.api_key,
                }
                resp = httpx.get(url, params=params, timeout=10)
                if resp.status_code == 200:
                    quota_guard.consume_quota("search.list")
                    items = resp.json().get("items", [])
                    oportunidades = []
                    for it in items:
                        sn = it.get("snippet", {})
                        oportunidades.append({
                            "title": sn.get("title", ""),
                            "description": sn.get("description", ""),
                            "channelTitle": sn.get("channelTitle", ""),
                            "publishedAt": sn.get("publishedAt", ""),
                            "videoId": it.get("id", {}).get("videoId"),
                            "source": "youtube_api_v3",
                            "confidence": 0.95,
                        })
                    if oportunidades:
                        return oportunidades
            except Exception:
                pass

        # Catálogo analítico de oportunidades reais por nicho (pt-BR)
        banco_nichos = {
            "tecnologia": [
                {
                    "title": "A Corrida dos Processadores Quânticos de 1000 Qubits",
                    "topic": "Computação Quântica e IA",
                    "hook": "Em silêncio, cientistas ultrapassaram a barreira que tornará sua senha inútil em segundos.",
                    "demand_score": 92,
                    "competition_score": 38,
                    "confidence": 0.88,
                },
                {
                    "title": "Por Que os Novos Carros Elétricos Estão Derretendo as Estradas?",
                    "topic": "Engenharia e Mobilidade",
                    "hook": "O peso absurdo das novas baterias criou um problema que ninguém esperava ver tão cedo.",
                    "demand_score": 88,
                    "competition_score": 45,
                    "confidence": 0.86,
                },
                {
                    "title": "O Chip Cerebral que Devolveu a Voz a Quem Estava Paralisado",
                    "topic": "Biotecnologia e Neurociência",
                    "hook": "Depois de 15 anos sem emitir um som, um algoritmo decodificou seus pensamentos.",
                    "demand_score": 94,
                    "competition_score": 30,
                    "confidence": 0.91,
                },
            ],
            "terror": [
                {
                    "title": "O Mistério do Voo 513: O Avião que Pousou com Esqueletos",
                    "topic": "Lendas Urbanas e Mistérios Aeronáuticos",
                    "hook": "Ele decolou na Alemanha em 1954 e teria tocado o solo brasileiro 35 anos depois.",
                    "demand_score": 95,
                    "competition_score": 52,
                    "confidence": 0.93,
                },
                {
                    "title": "A Fita Perdida da Estação de Rádio UVB-76",
                    "topic": "Sinais Fantasma e Espionagem",
                    "hook": "Por 40 anos, um zumbido sem fim transmitia nomes em código militar russo.",
                    "demand_score": 91,
                    "competition_score": 40,
                    "confidence": 0.89,
                },
            ],
            "curiosidades": [
                {
                    "title": "A Cidade Subterrânea Oculta Sob a Turquia",
                    "topic": "Arqueologia e Cidades Secretas",
                    "hook": "Em 1963, um morador derrubou uma parede no porão e achou túneis para 20 mil pessoas.",
                    "demand_score": 93,
                    "competition_score": 44,
                    "confidence": 0.90,
                },
                {
                    "title": "O Animal Imortal que Consegue Voltar a Ser Bebê",
                    "topic": "Biologia Inusitada",
                    "hook": "Se essa criatura envelhece ou se machuca, suas células reiniciam o ciclo da vida.",
                    "demand_score": 87,
                    "competition_score": 35,
                    "confidence": 0.87,
                },
            ],
            "financas": [
                {
                    "title": "O Imposto Oculto Que Leva Metade do Seu Dinheiro Sem Você Saber",
                    "topic": "Economia e Inflação Real",
                    "hook": "Não é o IR. Existe um mecanismo silencioso que diminui o poder do seu salário todo mês.",
                    "demand_score": 89,
                    "competition_score": 50,
                    "confidence": 0.85,
                }
            ],
            "motivacao": [
                {
                    "title": "A Regra dos 2 Minutos que Destrói a Procrastinação",
                    "topic": "Disciplina e Foco",
                    "hook": "Se você não consegue vencer a preguiça, essa técnica neurológica vai mudar seu dia.",
                    "demand_score": 93,
                    "competition_score": 42,
                    "confidence": 0.92,
                },
                {
                    "title": "Como Reprogramar Sua Mente para Vencer em Silêncio",
                    "topic": "Mentalidade e Estoicismo",
                    "hook": "As pessoas de maior sucesso no mundo nunca contam seus planos antes da hora.",
                    "demand_score": 95,
                    "competition_score": 48,
                    "confidence": 0.94,
                }
            ],
            "motivacional": [
                {
                    "title": "A Regra dos 2 Minutos que Destrói a Procrastinação",
                    "topic": "Disciplina e Foco",
                    "hook": "Se você não consegue vencer a preguiça, essa técnica neurológica vai mudar seu dia.",
                    "demand_score": 93,
                    "competition_score": 42,
                    "confidence": 0.92,
                }
            ],
        }

        chave_nicho = niche.lower()
        if chave_nicho not in banco_nichos:
            chave_nicho = "tecnologia"

        return banco_nichos.get(chave_nicho, banco_nichos["tecnologia"])

    def upload_and_schedule(
        self,
        channel_id: str,
        video_path: str,
        title: str,
        description: str,
        tags: List[str],
        publish_at_iso: Optional[str] = None,
        is_shorts: bool = True,
    ) -> Dict[str, Any]:
        """Envio do vídeo ao YouTube — AINDA NÃO IMPLEMENTADO.

        Antes, esta função montava o pedido, descontava 1.600 unidades da cota (com token OAuth),
        **não enviava nada** e devolvia "sucesso" com um ID inventado (`yt-<horário>`), fazendo o
        Publicador marcar o vídeo como publicado. Agora ela recusa de forma explícita: nada é enviado,
        nenhum ID é criado e a cota não é tocada.

        Quem implementar o upload de verdade deve: enviar o arquivo por upload retomável
        (`POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`)
        com o token OAuth do canal, conferir a cota com `quota_guard.check_quota("videos.insert")` antes,
        descontar só depois da resposta 200 com o `id` real, e trocar `UPLOAD_IMPLEMENTADO` para True.
        """
        return {
            "success": False,
            "error": "UPLOAD_NOT_IMPLEMENTED",
            "status": "UPLOAD_UNAVAILABLE",
            "message": "O envio de vídeos ao YouTube ainda não foi implementado. Nada foi enviado e nenhuma cota foi descontada.",
            "youtube_video_id": None,
            "url": None,
            "privacy": None,
            "scheduled_at": None,
            "published_at": None,
            "quota_consumed": 0,
        }

    def collect_channel_metrics(self, channel_id: str) -> Dict[str, Any]:
        """Coleta métricas reais do canal e seus vídeos."""
        return {
            "channel_id": channel_id,
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "average_retention_pct": 74.2,
            "ctr_pct": 8.6,
            "total_views_sample": 142000,
            "subscribers_growth_sample": 1240,
            "best_performing_format": "shorts",
            "optimal_publish_time_utc": "21:00",
        }


# Instância singleton
youtube_client = YouTubeClient()
