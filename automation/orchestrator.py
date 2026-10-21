"""Orquestrador do Pipeline Autônomo LeccorTubeAgent.

Gerencia o ciclo de vida dos lotes, estados da esteira industrial em formato U,
concorrência por vídeo, checkpoints e sinais de START, PAUSE, RESUME e STOP.
"""
from __future__ import annotations

import json
import queue
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from automation.agents import (
    AnalyticsAgent,
    AudioEngineerAgent,
    CreativeDirectorAgent,
    DesignerAgent,
    PublishingAgent,
    QualityControlAgent,
    ResearchAgent,
    ScriptAgent,
    StrategyAgent,
    VideoProducerAgent,
)
from automation.models import (
    AGENTS_METADATA,
    AgentState,
    Batch,
    DashboardResponse,
    StartBatchRequest,
    VideoBrief,
    VideoItem,
)
from automation.storage import storage


_ESTADO_LOTE = {
    "RUNNING": "ESTEIRA RODANDO", "PAUSING": "PAUSANDO", "PAUSED": "ESTEIRA PAUSADA", "STOPPING": "PARANDO",
    "STOPPED": "ESTEIRA PARADA", "COMPLETED": "LOTE CONCLUÍDO", "FAILED": "LOTE COM ERRO", "CREATED": "LOTE CRIADO",
}


def _status_esteira(batch) -> str:
    """Texto do selo de status no cabeçalho da Esteira: estado real do lote e quantos agentes são reais
    (antes era fixo em "PIPELINE ONLINE • 10/10 AGENTES SINCRONIZADOS")."""
    estado = _ESTADO_LOTE.get(batch.status, batch.status) if batch else "ESTEIRA OCIOSA"
    try:
        from automation.agents_catalog import resumo_menu_agentes
        reais, total = resumo_menu_agentes()
        return f"{estado} • {reais}/{total} AGENTES REAIS"
    except Exception:
        return estado


class AutomationOrchestrator:
    def __init__(self):
        self._lock = threading.RLock()
        self._active_batch: Optional[Batch] = None
        self._active_thread: Optional[threading.Thread] = None
        self._pause_event = threading.Event()
        self._pause_event.set()  # set = rodando normalmente; clear = pausado
        self._stop_requested = False
        self._subscribers: List[queue.Queue] = []

        # Instanciar agentes
        self.agent_research = ResearchAgent()
        self.agent_strategy = StrategyAgent()
        self.agent_script = ScriptAgent()
        self.agent_visual = CreativeDirectorAgent()
        self.agent_video = VideoProducerAgent()
        self.agent_audio = AudioEngineerAgent()
        self.agent_review = QualityControlAgent()
        self.agent_design = DesignerAgent()
        self.agent_publish = PublishingAgent()
        self.agent_analytics = AnalyticsAgent()

        # Carregar último lote do banco se houver
        latest = storage.get_latest_batch()
        if latest and latest.status in ("RUNNING", "PAUSED"):
            # Marca como PAUSED ao reiniciar o servidor
            latest.status = "PAUSED"
            storage.save_batch(latest)
            self._active_batch = latest
        elif latest:
            self._active_batch = latest

    def subscribe_events(self) -> queue.Queue:
        q = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe_events(self, q: queue.Queue):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def _broadcast(self, event_type: str, data: Dict[str, Any]):
        msg = {"type": event_type, "data": data, "timestamp": time.time()}
        with self._lock:
            for q in list(self._subscribers):
                try:
                    q.put_nowait(msg)
                except Exception:
                    pass

    # ==================== COMANDOS PRINCIPAIS ====================

    def start_batch(self, req: StartBatchRequest) -> Batch:
        with self._lock:
            if self._active_batch and self._active_batch.status == "RUNNING":
                return self._active_batch

            ch = storage.get_channel(req.channel_id)
            if not ch:
                raise ValueError(f"Canal {req.channel_id} não encontrado.")

            batch = Batch(
                channel_id=req.channel_id,
                niche=req.niche,
                subniche=req.subniche,
                format=req.format,
                video_count=req.video_count,
                mode=req.mode or ch.mode,
                status="RUNNING",
                queued_count=req.video_count,
            )

            # Criar os N vídeos na fila
            videos = []
            for i in range(req.video_count):
                agents_states = [
                    AgentState(order=m["order"], key=m["key"], name=m["name"])
                    for m in AGENTS_METADATA
                ]
                v = VideoItem(
                    batch_id=batch.id,
                    index_in_batch=i + 1,
                    title=f"Vídeo #{i + 1}: Explorando {req.subniche or req.niche}",
                    brief=VideoBrief(
                        title=f"Vídeo #{i + 1}: Explorando {req.subniche or req.niche}",
                        format=req.format if req.format in ("shorts", "longos") else "shorts",
                        narration_voice=req.narration_voice,
                        visual_style="anime_dark",
                    ),
                    agents=agents_states,
                )
                videos.append(v)
                storage.save_video(v)

            batch.current_video_id = videos[0].id
            storage.save_batch(batch)
            self._active_batch = batch
            self._stop_requested = False
            self._pause_event.set()

            storage.log_event(batch.id, videos[0].id, 1, "BATCH_STARTED", f"Lote de {req.video_count} vídeos iniciado no canal {ch.title}")
            self._broadcast("batch.started", {"batch": batch.model_dump()})

            # Iniciar thread de processamento
            self._active_thread = threading.Thread(target=self._run_batch_worker, args=(batch.id,), daemon=True)
            self._active_thread.start()

            return batch

    def pause_batch(self, batch_id: str):
        with self._lock:
            if self._active_batch and self._active_batch.id == batch_id:
                self._active_batch.status = "PAUSED"
                storage.save_batch(self._active_batch)
                self._pause_event.clear()  # Bloqueia a thread
                storage.log_event(batch_id, self._active_batch.current_video_id, None, "BATCH_PAUSED", "Esteira pausada pelo operador.")
                self._broadcast("batch.paused", {"batch_id": batch_id})
            else:
                b = storage.get_batch(batch_id)
                if b:
                    b.status = "PAUSED"
                    storage.save_batch(b)

    def resume_batch(self, batch_id: str):
        with self._lock:
            if self._active_batch and self._active_batch.id == batch_id:
                self._active_batch.status = "RUNNING"
                storage.save_batch(self._active_batch)
                self._pause_event.set()  # Desbloqueia a thread
                storage.log_event(batch_id, self._active_batch.current_video_id, None, "BATCH_RESUMED", "Produção retomada com sucesso.")
                self._broadcast("batch.resumed", {"batch_id": batch_id})
            else:
                b = storage.get_batch(batch_id)
                if b:
                    b.status = "RUNNING"
                    storage.save_batch(b)

    def stop_batch(self, batch_id: str):
        with self._lock:
            self._stop_requested = True
            if self._active_batch and self._active_batch.id == batch_id:
                self._active_batch.status = "STOPPED"
                storage.save_batch(self._active_batch)
                self._pause_event.set()  # Garante que não fica travado em pause
                storage.log_event(batch_id, self._active_batch.current_video_id, None, "BATCH_STOPPED", "Esteira interrompida com segurança pelo operador.")
                self._broadcast("batch.stopped", {"batch_id": batch_id})
            else:
                b = storage.get_batch(batch_id)
                if b:
                    b.status = "STOPPED"
                    storage.save_batch(b)

    # ==================== WORKER DA ESTEIRA ====================

    def _run_batch_worker(self, batch_id: str):
        batch = storage.get_batch(batch_id)
        if not batch:
            return

        videos = storage.list_videos_by_batch(batch_id)

        for video in videos:
            if self._stop_requested:
                break

            batch.current_video_id = video.id
            storage.save_batch(batch)

            # Executa as 10 estações sequenciais no vídeo
            self._process_video_pipeline(batch, video)
            if video.status == "REJECTED":
                storage.log_event(batch.id, video.id, None, "VIDEO_REJECTED",
                                  video.brief.sources_rationale.get("script", "Vídeo reprovado"))

            if video.status in ("PUBLISHED", "DRAFT_READY", "AWAITING_APPROVAL", "LEARNING_RECORDED"):
                batch.produced_count += 1
                batch.queued_count = max(0, batch.video_count - batch.produced_count)
                if video.status == "PUBLISHED":
                    batch.published_count += 1
                storage.save_batch(batch)

        with self._lock:
            if not self._stop_requested:
                batch.status = "COMPLETED"
                storage.save_batch(batch)
                storage.log_event(batch.id, None, None, "BATCH_COMPLETED", f"Lote concluído: {batch.produced_count}/{batch.video_count} vídeos produzidos.")
                self._broadcast("batch.completed", {"batch_id": batch.id})

    def _process_video_pipeline(self, batch: Batch, video: VideoItem):
        """Processa um vídeo pelas 10 estações da esteira em U."""

        def check_pause_and_stop():
            self._pause_event.wait()
            # Vídeo reprovado (ex.: tema sensível no Roteirista) não segue para imagem, voz, render nem publicação
            return self._stop_requested or video.status == "REJECTED"

        def on_agent_progress(order: int, key: str, status: str, progress: int, message: str, step: Optional[str]):
            # Callback disparado a cada atualização de agente
            storage.save_video(video)
            self._broadcast("agent.progress", {
                "batch_id": batch.id,
                "video_id": video.id,
                "agent_order": order,
                "key": key,
                "status": status,
                "progress": progress,
                "message": message,
                "current_step": step,
            })

        # 01. Pesquisador
        if not check_pause_and_stop():
            self.agent_research.execute(video, batch.niche, batch.subniche, cb=on_agent_progress)
            storage.save_video(video)

        # 02. Estrategista
        if not check_pause_and_stop():
            self.agent_strategy.execute(video, batch.format, cb=on_agent_progress)
            storage.save_video(video)

        # 03. Roteirista
        if not check_pause_and_stop():
            self.agent_script.execute(video, cb=on_agent_progress)
            storage.save_video(video)

        # 04. Diretor Visual
        if not check_pause_and_stop():
            self.agent_visual.execute(video, cb=on_agent_progress)
            storage.save_video(video)

        # 05. Produtor de Vídeo (Hero)
        if not check_pause_and_stop():
            self.agent_video.execute(video, check_cancel=check_pause_and_stop, cb=on_agent_progress)
            storage.save_video(video)

        # 06. Engenheiro de Áudio
        if not check_pause_and_stop():
            self.agent_audio.execute(video, cb=on_agent_progress)
            storage.save_video(video)

        # 07. Revisor QA
        if not check_pause_and_stop():
            self.agent_review.execute(video, cb=on_agent_progress)
            storage.save_video(video)

        # 08. Designer
        if not check_pause_and_stop():
            self.agent_design.execute(video, cb=on_agent_progress)
            storage.save_video(video)

        # 09. Publicador
        if not check_pause_and_stop():
            ch = storage.get_channel(batch.channel_id)
            mode = ch.mode if ch else "assisted"
            self.agent_publish.execute(video, channel_mode=mode, cb=on_agent_progress)
            storage.save_video(video)

        # 10. Analista
        if not check_pause_and_stop():
            self.agent_analytics.execute(video, cb=on_agent_progress)
            video.overall_progress = 100
            video.estimated_seconds_remaining = 0
            storage.save_video(video)

    # ==================== ESTADO DO DASHBOARD ====================

    def get_dashboard_state(self, channel_id: Optional[str] = None) -> DashboardResponse:
        with self._lock:
            batch = self._active_batch
            if not batch and channel_id:
                # Tenta achar o último do canal
                pass

            ch = storage.get_channel(batch.channel_id if batch else (channel_id or "techfuture"))

            current_video = None
            agents_list = []

            if batch and batch.current_video_id:
                current_video_obj = storage.get_video(batch.current_video_id)
                if current_video_obj:
                    current_video = {
                        "id": current_video_obj.id,
                        "title": current_video_obj.title,
                        "overall_progress": current_video_obj.overall_progress,
                        "current_agent": current_video_obj.current_agent_order,
                        "estimated_seconds_remaining": current_video_obj.estimated_seconds_remaining,
                        "status": current_video_obj.status,
                        "artifacts": current_video_obj.artifacts,
                        "publication": current_video_obj.publication,
                        "brief": current_video_obj.brief.model_dump(),
                    }
                    agents_list = [a.model_dump() for a in current_video_obj.agents]

            if not agents_list:
                # Monta lista de agentes padrão em WAITING
                agents_list = [
                    {
                        "order": m["order"],
                        "key": m["key"],
                        "name": m["name"],
                        "status": "WAITING",
                        "progress": 0,
                        "message": "Aguardando início",
                        "current_step": None,
                        "updated_at": time.time(),
                    }
                    for m in AGENTS_METADATA
                ]

            is_running = batch.status == "RUNNING" if batch else False
            is_paused = batch.status == "PAUSED" if batch else False

            return DashboardResponse(
                batch_id=batch.id if batch else None,
                status=batch.status if batch else "WAITING",
                channel_id=ch.id if ch else None,
                channel=ch.model_dump() if ch else None,
                current_video=current_video,
                batch={
                    "requested": batch.video_count if batch else 3,
                    "produced": batch.produced_count if batch else 0,
                    "published": batch.published_count if batch else 0,
                    "queued": batch.queued_count if batch else 0,
                },
                agents=agents_list,
                publication=current_video.get("publication") if current_video else {"status": "DRAFT", "scheduled_at": None},
                cluster_status=_status_esteira(batch),
                is_running=is_running,
                is_paused=is_paused,
                updated_at=time.time(),
            )


# Instância singleton
orchestrator = AutomationOrchestrator()
