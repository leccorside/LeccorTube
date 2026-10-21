"""Modelos de dados e contratos do Pipeline Autônomo LeccorTubeAgent."""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==================== CONSTANTES E ENUMS ====================

AGENTS_METADATA = [
    {
        "order": 1,
        "key": "research",
        "name": "Pesquisador",
        "tag": "01 • PESQUISA",
        "description": "Identifica tendências & pautas virais no YouTube",
        "detail": "Minera vídeos públicos e termos emergentes"
    },
    {
        "order": 2,
        "key": "strategy",
        "name": "Estrategista",
        "tag": "02 • ESTRATÉGIA",
        "description": "Seleciona os melhores temas e formatos de alto CTR",
        "detail": "Calcula Opportunity Score e ângulo de retenção"
    },
    {
        "order": 3,
        "key": "script",
        "name": "Roteirista",
        "tag": "03 • ROTEIRO",
        "description": "Cria títulos magnéticos, ganchos e roteiros completos",
        "detail": "Estrutura hook, progressão, payoff e CTA"
    },
    {
        "order": 4,
        "key": "visual",
        "name": "Diretor Visual",
        "tag": "04 • DIREÇÃO",
        "description": "Planeja cortes, ritmo, paleta e enquadramento de cenas",
        "detail": "Gera prompts neurais em inglês e paleta de estilo"
    },
    {
        "order": 5,
        "key": "video",
        "name": "Produtor de Vídeo",
        "tag": "05 • FORJA ATIVA",
        "description": "Renderiza frames e sintetiza cenas pelo gerador existente",
        "detail": "Conecta ao ComfyUI e motor de render do LeccorTube"
    },
    {
        "order": 6,
        "key": "audio",
        "name": "Engenheiro de Áudio",
        "tag": "06 • ÁUDIO & SFX",
        "description": "Sintetiza vozes neurais, trilhas sonoras e masteriza -18 LUFS",
        "detail": "Narração pt-BR Chatterbox, Whisper e som ambiente"
    },
    {
        "order": 7,
        "key": "review",
        "name": "Revisor QA",
        "tag": "07 • QA REVISOR",
        "description": "Confere o roteiro contra os fatos, antes das imagens",
        "detail": "Números, unidades e afirmações contra a Wikipédia (roda logo depois do Roteirista)"
    },
    {
        "order": 8,
        "key": "design",
        "name": "Designer",
        "tag": "08 • DESIGNER",
        "description": "Gera variantes de miniaturas e textos de alto impacto",
        "detail": "Textos concisos e composição contrastante"
    },
    {
        "order": 9,
        "key": "publish",
        "name": "Publicador",
        "tag": "09 • PUBLICAÇÃO",
        "description": "Faz upload privado, tags, cards e agenda a estreia",
        "detail": "YouTube Data API v3 com agendamento ISO 8601"
    },
    {
        "order": 10,
        "key": "analytics",
        "name": "Analista",
        "tag": "10 • ANALISTA",
        "description": "Mede retenção e realimenta o Pesquisador com melhorias",
        "detail": "Aprendizado contínuo, hipóteses e retroalimentação"
    }
]


class AgentState(BaseModel):
    order: int
    key: str
    name: str
    status: str = "WAITING"  # WAITING, RUNNING, COMPLETED, PAUSED, FAILED, BLOCKED
    progress: int = 0
    message: str = "Aguardando início"
    current_step: Optional[str] = None
    updated_at: float = Field(default_factory=time.time)


class YouTubeChannel(BaseModel):
    id: str
    title: str
    handle: str = ""
    subscribers_count: int = 0
    thumbnail_url: str = ""
    is_authenticated: bool = True
    mode: str = "assisted"  # manual, assisted, automatic
    default_niche: str = "tecnologia"
    default_subniche: str = ""
    default_format: str = "shorts"  # shorts, longos, ambos
    publication_policy: str = "draft"  # draft, schedule, publish_after_qa
    max_videos_per_day: int = 3
    daily_budget_usd: float = 20.0
    created_at: float = Field(default_factory=time.time)


class Opportunity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    topic: str
    subtopic: str = ""
    keywords: List[str] = Field(default_factory=list)
    format_type: str = "shorts"
    opportunity_score: int = 75  # 0-100
    demand_score: int = 80
    competition_score: int = 40
    channel_fit_score: int = 85
    rationale: str = ""
    evidence_sources: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = 0.88
    created_at: float = Field(default_factory=time.time)


class ScenePrompt(BaseModel):
    scene_index: int
    text_pt: str
    prompt_en: str
    duration_est_seconds: float = 4.0
    image_path: Optional[str] = None


class VideoBrief(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: Optional[str] = None
    title: str
    alternative_titles: List[str] = Field(default_factory=list)
    format: str = "shorts"
    visual_style: str = "anime_dark"
    thumbnail_text: str = ""
    script_hook: str = ""
    script_body: str = ""
    script_cta: str = ""
    scenes: List[ScenePrompt] = Field(default_factory=list)
    narration_voice: str = "oficial"
    captions_position: str = "middle"  # top, middle, bottom
    captions_color: str = "#ffffff"
    captions_highlight: str = "#f59e0b"
    ambient_sound: str = "none"
    ambient_volume: int = 30
    description: str = ""
    hashtags: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    target_duration_seconds: int = 60
    estimated_cost_usd: float = 0.15
    sources_rationale: Dict[str, str] = Field(default_factory=dict)
    research_facts: str = ""  # trechos da Wikipédia escolhidos pelo Pesquisador (#01), contexto do Roteirista (#03)
    research_sources: List[str] = Field(default_factory=list)  # URLs dos artigos usados


class QAChecklist(BaseModel):
    video_integrity: bool = True
    subtitles_safe_zone: bool = True
    audio_loudness_ok: bool = True
    no_copyright_violation: bool = True
    no_misleading_metadata: bool = True
    factual_confidence_high: bool = True
    notes: List[str] = Field(default_factory=list)
    approved: bool = True


class VideoItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_id: str
    index_in_batch: int = 1
    title: str
    status: str = "IDEA_DISCOVERED"
    # Estados: IDEA_DISCOVERED, IDEA_SCORED, SCRIPT_DRAFT, SCRIPT_APPROVED,
    # ASSETS_GENERATING, RENDERING, QA_PENDING, DRAFT_READY, AWAITING_APPROVAL,
    # APPROVED, UPLOAD_QUEUED, UPLOADING, UPLOADED_PRIVATE, SCHEDULED, PUBLISHED,
    # REJECTED, FAILED, CANCELED
    current_agent_order: int = 1
    overall_progress: int = 0
    estimated_seconds_remaining: int = 1080
    brief: VideoBrief
    agents: List[AgentState] = Field(default_factory=list)
    qa: Optional[QAChecklist] = None
    artifacts: Dict[str, Any] = Field(default_factory=dict)
    # Ex: {"video_path": "...", "thumbnail_path": "...", "subtitles_path": "..."}
    publication: Dict[str, Any] = Field(default_factory=dict)
    # Ex: {"status": "DRAFT", "youtube_video_id": None, "scheduled_at": None, "url": None}
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class Batch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    niche: str
    subniche: str = ""
    format: str = "shorts"
    video_count: int = 3
    mode: str = "assisted"  # manual, assisted, automatic
    status: str = "CREATED"  # CREATED, RUNNING, PAUSING, PAUSED, COMPLETED, STOPPING, STOPPED, FAILED
    current_video_id: Optional[str] = None
    produced_count: int = 0
    published_count: int = 0
    queued_count: int = 0
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class StartBatchRequest(BaseModel):
    channel_id: str
    niche: str = "tecnologia"
    subniche: str = ""
    format: str = "shorts"  # shorts, longos, ambos
    video_count: int = 3
    narration_voice: str = "oficial"  # id retornado por GET /api/opcoes em vozes[]
    mode: Optional[str] = "assisted"
    publication_policy_id: Optional[str] = "draft"
    idempotency_key: Optional[str] = None


class DashboardResponse(BaseModel):
    batch_id: Optional[str] = None
    status: str = "WAITING"  # WAITING, RUNNING, PAUSED, COMPLETED, STOPPED
    channel_id: Optional[str] = None
    channel: Optional[Dict[str, Any]] = None
    current_video: Optional[Dict[str, Any]] = None
    batch: Dict[str, Any] = Field(default_factory=lambda: {"requested": 3, "produced": 0, "published": 0, "queued": 0})
    agents: List[Dict[str, Any]] = Field(default_factory=list)
    publication: Dict[str, Any] = Field(default_factory=lambda: {"status": "DRAFT", "scheduled_at": None})
    cluster_status: str = "ESTEIRA OCIOSA"  # montado com dados reais em orchestrator._status_esteira
    is_running: bool = False
    is_paused: bool = False
    updated_at: float = Field(default_factory=time.time)
