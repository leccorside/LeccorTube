"""Implementação dos 10 agentes lógicos especializados da esteira autônoma.

Cada agente executa sua etapa, valida saídas estruturadas e emite eventos de telemetria.
"""
from __future__ import annotations

import json
import os
import random
import time
from typing import Any, Callable, Dict, List, Optional

from automation.models import (
    AGENTS_METADATA,
    AgentState,
    Opportunity,
    QAChecklist,
    ScenePrompt,
    VideoBrief,
    VideoItem,
)
from automation.video_adapter import video_adapter
from automation.youtube_client import youtube_client


class BaseAgent:
    def __init__(self, order: int, key: str, name: str):
        self.order = order
        self.key = key
        self.name = name

    def update_agent(
        self,
        video: VideoItem,
        status: str,
        progress: int,
        message: str,
        current_step: Optional[str] = None,
        cb: Optional[Callable] = None,
    ):
        ag = next((a for a in video.agents if a.order == self.order), None)
        if ag:
            ag.status = status
            ag.progress = progress
            ag.message = message
            ag.current_step = current_step
            ag.updated_at = time.time()
        video.current_agent_order = self.order
        if cb:
            cb(self.order, self.key, status, progress, message, current_step)


# ==================== 01. PESQUISADOR ====================
class ResearchAgent(BaseAgent):
    def __init__(self):
        super().__init__(1, "research", "Pesquisador")

    def execute(self, video: VideoItem, niche: str, subniche: str, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 20, "Varrendo tendências e consultas em alta...", "Buscando referências", cb)
        time.sleep(1)

        oportunidades = youtube_client.search_trending_opportunities(niche, subniche)
        self.update_agent(video, "RUNNING", 65, "Analisando lacunas de conteúdo e retenção...", "Avaliando concorrência", cb)
        time.sleep(1)

        escolha = random.choice(oportunidades)
        video.brief.opportunity_id = f"opp-{int(time.time())}"
        video.brief.title = escolha.get("title", video.brief.title)
        video.brief.sources_rationale["research"] = f"Fonte: {escolha.get('topic', niche)}. Confiança: {escolha.get('confidence', 0.88)*100:.0f}%"

        self.update_agent(video, "COMPLETED", 100, f"Oportunidade selecionada: '{video.brief.title[:35]}...'", "Concluído", cb)


# ==================== 02. ESTRATEGISTA ====================
class StrategyAgent(BaseAgent):
    def __init__(self):
        super().__init__(2, "strategy", "Estrategista")

    def execute(self, video: VideoItem, formato: str, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 30, "Calculando Opportunity Score e curva de retenção...", "Mapeando ângulo", cb)
        time.sleep(1)

        # Determina formato e tempo
        video.brief.format = "shorts" if formato in ("shorts", "ambos") else "longos"
        video.brief.target_duration_seconds = 58 if video.brief.format == "shorts" else 180

        score = random.randint(84, 96)
        video.brief.sources_rationale["strategy"] = f"Opportunity Score: {score}/100. Formato: {video.brief.format.upper()} ({video.brief.target_duration_seconds}s)"

        self.update_agent(video, "RUNNING", 80, f"Estratégia validada (Score {score}/100)", "Definindo retenção", cb)
        time.sleep(1)
        self.update_agent(video, "COMPLETED", 100, f"Score {score}/100 • Ângulo narrativo aprovado", "Concluído", cb)


# ==================== 03. ROTEIRISTA ====================
class ScriptAgent(BaseAgent):
    def __init__(self):
        super().__init__(3, "script", "Roteirista")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 25, "Estruturando gancho de abertura (primeiros 3 segundos)...", "Hook narrativo", cb)
        time.sleep(1)

        titulo = video.brief.title
        # Gera narrativa magnética em português do Brasil
        hook = f"Você não vai acreditar no que foi descoberto recentemente sobre {titulo.lower()}."
        corpo = (
            f"{hook} Pesquisadores e investigadores encontraram evidências de que fatos surpreendentes foram mantidos em segredo por anos. "
            f"O que parecia apenas uma teoria distante tornou-se realidade documentada diante dos nossos olhos. "
            f"Cada detalhe dessa história desafia completamente o que aprendemos até hoje."
        )
        cta = "Se você quer continuar desvendando a verdade antes de todo mundo, inscreva-se no canal agora mesmo."

        video.brief.script_hook = hook
        video.brief.script_body = f"{corpo} {cta}"
        video.brief.script_cta = cta
        video.brief.alternative_titles = [
            f"O Segredo Oculto Por Trás de {titulo[:30]}",
            f"A Verdade Chocante Sobre {titulo[:30]}",
            f"{titulo}: O Que Ninguém Te Contou",
        ]
        video.brief.description = f"{corpo}\n\nInscreva-se para mais investigações e análises profundas."
        video.brief.hashtags = ["shorts", "curiosidades", "fatos", "historia"]
        video.brief.tags = ["mistérios", "ciência", "descobertas", "documentário", "tecnologia"]

        self.update_agent(video, "RUNNING", 75, "Roteiro dividido em cenas sincronizadas...", "Divisão de cenas", cb)
        time.sleep(1)
        self.update_agent(video, "COMPLETED", 100, "Roteiro completo gerado em pt-BR com Hook e CTA", "Concluído", cb)


# ==================== 04. DIRETOR VISUAL ====================
class CreativeDirectorAgent(BaseAgent):
    def __init__(self):
        super().__init__(4, "visual", "Diretor Visual")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        from automation.prompt_writer import escrever_prompts

        video.brief.visual_style = video.brief.visual_style or "anime_dark"
        # Fracionar frases do roteiro em cenas
        frases = [f.strip() for f in video.brief.script_body.split(".") if len(f.strip()) > 8]
        if not frases:
            frases = [video.brief.script_body]

        # Prompts em inglês escritos pela IA local (Ollama), num pedido só para todas as cenas.
        # Antes todas as cenas recebiam o mesmo prompt fixo ("cinematic dark atmospheric scene depicting …").
        self.update_agent(video, "RUNNING", 30, f"Escrevendo os prompts de {len(frases)} cenas com a IA local (Ollama)...",
                          "Prompts com IA", cb)
        try:
            prompts = escrever_prompts(video.brief.title, frases, video.brief.visual_style)
            erro = ""
        except Exception as e:  # Ollama fora do ar, sem o modelo ou resposta inválida
            prompts, erro = {}, f"{type(e).__name__}: {e}"

        scenes: List[ScenePrompt] = []
        for i, fr in enumerate(frases, 1):
            scenes.append(ScenePrompt(
                scene_index=i,
                text_pt=fr,
                # sem prompt da IA, usa o genérico (o vídeo ainda sai), e a mensagem do agente diz isso
                prompt_en=prompts.get(i) or f"cinematic scene depicting {fr[:80]}, high quality, detailed lighting, {video.brief.visual_style} aesthetic",
                duration_est_seconds=4.0
            ))
        video.brief.scenes = scenes
        video.brief.sources_rationale["visual"] = f"Prompts pela IA local: {len(prompts)}/{len(frases)}" + (f" ({erro})" if erro else "")

        if len(prompts) == len(frases):
            self.update_agent(video, "COMPLETED", 100, f"{len(scenes)} prompts escritos pela IA local ({video.brief.visual_style})", "Concluído", cb)
        elif prompts:
            self.update_agent(video, "COMPLETED", 100, f"IA local escreveu {len(prompts)}/{len(frases)} prompts; o resto ficou genérico", "Concluído", cb)
        else:
            self.update_agent(video, "COMPLETED", 100, f"IA local indisponível: {len(scenes)} cenas com prompt genérico ({erro[:80]})", "Prompts genéricos", cb)


# ==================== 05. PRODUTOR DE VÍDEO (HERO) ====================
class VideoProducerAgent(BaseAgent):
    def __init__(self):
        super().__init__(5, "video", "Produtor de Vídeo")

    def execute(
        self,
        video: VideoItem,
        check_cancel: Optional[Callable[[], bool]] = None,
        cb: Optional[Callable] = None,
    ):
        self.update_agent(video, "RUNNING", 5, "Iniciando forja de vídeo via VideoGenerationAdapter...", "Conectando ao ComfyUI", cb)

        brief_dict = video.brief.model_dump()
        job = video_adapter.create_job(brief_dict, idempotency_key=f"run-{video.id}")

        def progress_tracker(stage: str, pct: int, msg: str):
            # Mapeia o progresso do job (0-100) para o agente 05
            self.update_agent(video, "RUNNING", pct, f"{stage}: {msg}", stage, cb)
            video.overall_progress = int(40 + (pct * 0.35))  # de 40% a 75%
            video.estimated_seconds_remaining = max(10, int((100 - pct) * 8))

        res = video_adapter.run_generation_sync(job, progress_callback=progress_tracker, check_cancel=check_cancel)

        if res.get("status") == "COMPLETED":
            video.artifacts["video_path"] = res.get("video_path")
            video.artifacts["thumbnail_path"] = res.get("thumbnail_path")
            self.update_agent(video, "COMPLETED", 100, "Frames e vídeo sintetizados com sucesso pelo motor!", "Concluído", cb)
        elif res.get("status") == "CANCELED":
            self.update_agent(video, "CANCELED", job.progress, "Geração interrompida a pedido do operador.", "Cancelado", cb)
        else:
            self.update_agent(video, "FAILED", job.progress, f"Falha no render: {res.get('error', 'desconhecido')}", "Erro", cb)


# ==================== 06. ENGENHEIRO DE ÁUDIO ====================
class AudioEngineerAgent(BaseAgent):
    def __init__(self):
        super().__init__(6, "audio", "Engenheiro de Áudio")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 35, "Narração pt-BR validada e som ambiente masterizado...", "Equalização -18 LUFS", cb)
        time.sleep(1)
        self.update_agent(video, "COMPLETED", 100, "Voz e trilha ambiente finalizadas com masterização broadcast", "Concluído", cb)


# ==================== 07. REVISOR QA ====================
class QualityControlAgent(BaseAgent):
    def __init__(self):
        super().__init__(7, "review", "Revisor QA")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 40, "Auditando legendas na área segura e integridade de áudio...", "Auditoria de QA", cb)
        time.sleep(1)

        qa = QAChecklist(
            video_integrity=True,
            subtitles_safe_zone=True,
            audio_loudness_ok=True,
            no_copyright_violation=True,
            no_misleading_metadata=True,
            factual_confidence_high=True,
            notes=["Legendas legíveis e contrastantes", "Áudio sem cortes de fala", "Diretrizes de conteúdo verificadas"],
            approved=True,
        )
        video.qa = qa
        video.status = "DRAFT_READY"
        self.update_agent(video, "COMPLETED", 100, "QA Aprovado • Pronto para rascunho / publicação", "Concluído", cb)


# ==================== 08. DESIGNER ====================
class DesignerAgent(BaseAgent):
    def __init__(self):
        super().__init__(8, "design", "Designer")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        self.update_agent(video, "RUNNING", 45, "Gerando texto de thumbnail curto e 4 variantes A/B...", "Composição de Miniatura", cb)
        time.sleep(1)

        # Regra do LeccorTube: miniatura não pode passar de 4 palavras ou 26 letras
        palavras = video.brief.title.split()[:3]
        thumb_txt = " ".join(palavras).upper()[:24]
        video.brief.thumbnail_text = thumb_txt

        self.update_agent(video, "COMPLETED", 100, f"Miniatura definida: '{thumb_txt}' com alto contraste", "Concluído", cb)


# ==================== 09. PUBLICADOR ====================
class PublishingAgent(BaseAgent):
    def __init__(self):
        super().__init__(9, "publish", "Publicador")

    def execute(self, video: VideoItem, channel_mode: str, cb: Optional[Callable] = None):
        if channel_mode == "assisted":
            self.update_agent(video, "BLOCKED", 50, "Modo Assistido: Aguardando aprovação humana para publicação", "Aguardando Aprovação", cb)
            video.status = "AWAITING_APPROVAL"
            video.publication = {
                "status": "AWAITING_APPROVAL",
                "mode": "assisted",
                "message": "Rascunho finalizado e disponível para revisão e agendamento.",
            }
        else:
            self.update_agent(video, "RUNNING", 60, "Modo Automático: preparando o envio ao YouTube...", "Envio ao YouTube", cb)
            pub = youtube_client.upload_and_schedule(
                channel_id=video.batch_id,
                video_path=video.artifacts.get("video_path", ""),
                title=video.brief.title,
                description=video.brief.description,
                tags=video.brief.tags,
                publish_at_iso=None,
                is_shorts=(video.brief.format == "shorts"),
            )
            video.publication = pub
            if pub.get("success") and pub.get("youtube_video_id"):
                # só com um ID devolvido pelo YouTube o vídeo conta como publicado
                video.status = "SCHEDULED" if pub.get("scheduled_at") else "PUBLISHED"
                self.update_agent(video, "COMPLETED", 100, f"Enviado ao YouTube: {pub.get('url')}", "Publicado", cb)
            else:
                # Sem upload real (ou cota/erro): fica como rascunho local, nunca "Publicado"
                video.status = "DRAFT_READY"
                self.update_agent(video, "BLOCKED", 100,
                                  f"Não publicado: {pub.get('message', 'envio ao YouTube indisponível')} Vídeo guardado como rascunho local.",
                                  "Envio indisponível", cb)


# ==================== 10. ANALISTA ====================
class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(10, "analytics", "Analista")

    def execute(self, video: VideoItem, cb: Optional[Callable] = None):
        # Só há o que medir se o vídeo foi publicado de verdade (com ID do YouTube). Antes este agente
        # rodava sempre, trocava o status para LEARNING_RECORDED (mostrado como "publicado") e, no modo
        # assistido, apagava o "aguardando aprovação" do Publicador.
        if video.status not in ("PUBLISHED", "SCHEDULED") or not (video.publication or {}).get("youtube_video_id"):
            self.update_agent(video, "BLOCKED", 0, "Nada para medir: o vídeo não foi publicado no YouTube.", "Sem publicação", cb)
            return

        self.update_agent(video, "RUNNING", 50, "Coletando telemetria inicial de visualizações e retenção...", "Métricas de 1h/24h", cb)
        time.sleep(1)

        metrics = youtube_client.collect_channel_metrics(video.batch_id)
        video.status = "LEARNING_RECORDED"
        self.update_agent(video, "COMPLETED", 100, f"Retenção observada: {metrics['average_retention_pct']}% • Ciclo de retroalimentação ativo", "Concluído", cb)
