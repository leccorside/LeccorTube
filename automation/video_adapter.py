"""Adaptador de integração com o gerador de vídeos existente do LeccorTube.

Conforme especificado na Seção 9 e Seção 1 do PIPELINE_AUTOMATICO_YOUTUBE.md:
O mecanismo de geração/renderização existente NÃO é recriado; ele é reutilizado
de forma transparente via VideoGenerationAdapter.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from typing import Any, Callable, Dict, Optional

import httpx

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "tools", "diag"))
import ambiente  # noqa: E402
import vozes  # noqa: E402

APP_URL = "http://127.0.0.1:7860"
OLLAMA_URL = "http://127.0.0.1:11434"
MODELO_IA = "qwen2.5vl:7b"
LOG_PATH = os.path.join(RAIZ, "logs", "pipeline_adapter.log")


def _log(msg: str):
    linha = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [VideoAdapter] {msg}\n"
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(linha)
    except Exception:
        pass


class GenerationJob:
    def __init__(self, job_id: str, brief: Dict[str, Any], idempotency_key: str):
        self.job_id = job_id
        self.brief = brief
        self.idempotency_key = idempotency_key
        self.status = "PENDING"  # PENDING, RUNNING, COMPLETED, FAILED, CANCELED
        self.progress = 0
        self.current_stage = "Iniciando"
        self.project_id: Optional[str] = None
        self.video_path: Optional[str] = None
        self.thumbnail_path: Optional[str] = None
        self.metadata_path: Optional[str] = None
        self.duration_seconds: float = 0.0
        self.error: Optional[str] = None
        self.cancel_requested = False


class VideoGenerationAdapter:
    """Implementa o contrato do gerador existente do LeccorTube."""

    def __init__(self):
        self._jobs: Dict[str, GenerationJob] = {}
        self._lock = threading.Lock()

    def validate(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        """Valida os parâmetros do brief antes de criar o job."""
        errors = []
        if not brief.get("title", "").strip():
            errors.append("Título é obrigatório.")
        if not brief.get("script_body", "").strip() and not brief.get("scenes"):
            errors.append("Roteiro ou cenas são obrigatórios.")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "estimated_cost_usd": 0.15,
            "estimated_duration_seconds": brief.get("target_duration_seconds", 60),
        }

    def create_job(self, brief: Dict[str, Any], idempotency_key: str) -> GenerationJob:
        with self._lock:
            # Idempotência: se já existir com a mesma chave, retorna o existente
            for existing in self._jobs.values():
                if existing.idempotency_key == idempotency_key:
                    return existing

            job_id = f"job-{int(time.time())}-{len(self._jobs) + 1}"
            job = GenerationJob(job_id=job_id, brief=brief, idempotency_key=idempotency_key)
            self._jobs[job_id] = job
            return job

    def get_status(self, job_id: str) -> Dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return {"status": "NOT_FOUND", "progress": 0}
            return {
                "status": job.status,
                "progress": job.progress,
                "stage": job.current_stage,
                "project_id": job.project_id,
                "video_path": job.video_path,
                "error": job.error,
            }

    def cancel_job(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.cancel_requested = True
                job.status = "CANCELED"
                _log(f"Job {job_id} marcado para cancelamento.")

    def run_generation_sync(
        self,
        job: GenerationJob,
        progress_callback: Optional[Callable[[str, int, str], None]] = None,
        check_cancel: Optional[Callable[[], bool]] = None,
    ) -> Dict[str, Any]:
        """Executa a geração completa usando o pipeline existente do LeccorTube.

        progress_callback(fase, porcentagem, mensagem)
        """
        def report(stage: str, pct: int, msg: str):
            job.current_stage = stage
            job.progress = pct
            _log(f"[{job.job_id}] [{pct}%] {stage}: {msg}")
            if progress_callback:
                progress_callback(stage, pct, msg)

        def is_canceled() -> bool:
            if job.cancel_requested:
                return True
            if check_cancel and check_cancel():
                return True
            return False

        job.status = "RUNNING"
        report("Preparando", 5, "Inicializando workspace e conferindo serviços...")

        try:
            # 1. Checar conectividade do app 7860
            try:
                r = httpx.get(f"{APP_URL}/api/app", timeout=4)
                if r.status_code != 200:
                    raise RuntimeError("App principal 7860 não respondeu status 200.")
            except Exception as e:
                report("Aviso", 8, "Iniciando servidor do LeccorTube na porta 7860...")
                # Inicia o app se necessário
                subprocess.Popen(
                    [os.path.join(RAIZ, ".venv", "Scripts", "python.exe"), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "7860"],
                    cwd=RAIZ,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                time.sleep(3)

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # 2. Criar projeto no motor do LeccorTube
            b = job.brief
            titulo = b.get("title", "Sem título")
            estilo = b.get("visual_style", "anime_dark")
            formato = b.get("format", "shorts")
            duracao_alvo = b.get("target_duration_seconds", 60)
            tipo_motor = "short" if formato == "shorts" else "mystery"

            report("Criando projeto", 12, f"Registrando projeto: '{titulo[:40]}...'")
            r_proj = httpx.post(
                f"{APP_URL}/api/projects",
                json={
                    "title": titulo,
                    "type": tipo_motor,
                    "target_duration": duracao_alvo,
                    "style_id": estilo,
                    "voice_fx": "none",
                    "voice_clean": False,
                },
                timeout=15,
            )
            if r_proj.status_code not in (200, 201):
                raise RuntimeError(f"Erro ao criar projeto na API 7860: {r_proj.text}")

            proj_data = r_proj.json()
            project_id = proj_data.get("id")
            job.project_id = project_id
            _log(f"Projeto criado: {project_id}")

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # 3. Montar roteiro e cenas com prompts em inglês via Ollama se necessário
            scenes = b.get("scenes", [])
            roteiro = b.get("script_body", "")

            # Se não vieram cenas pré-divididas, dividir por frases
            if not scenes and roteiro:
                frases = [f.strip() for f in re.split(r"[.!?]+", roteiro) if len(f.strip()) > 8]
                if not frases:
                    frases = [roteiro.strip()]
                scenes = [{"scene_index": i + 1, "text_pt": f, "prompt_en": ""} for i, f in enumerate(frases)]

            report("Prompts visuais", 20, "Escrevendo prompts das cenas com IA local (Ollama)...")
            scenes_to_save = []
            for idx, sc in enumerate(scenes):
                if is_canceled():
                    job.status = "CANCELED"
                    return {"status": "CANCELED"}

                prompt_en = sc.get("prompt_en")
                text_pt = sc.get("text_pt", "")
                if not prompt_en:
                    # Gera prompt em inglês via Ollama
                    prompt_en = self._gerar_prompt_ollama(text_pt, estilo)

                scenes_to_save.append({
                    "id": f"s{idx + 1:03d}",
                    "text": text_pt,
                    "prompt": prompt_en,
                    "media": "image",
                    "prompt_manual": True,
                })

            # Atualizar cenas no projeto do motor
            httpx.put(f"{APP_URL}/api/projects/{project_id}/scenes", json={"scenes": scenes_to_save}, timeout=15)

            # Configurar legendas
            pos_legenda = b.get("captions_position", "middle")
            cor_legenda = b.get("captions_color", "#ffffff")
            destaque_legenda = b.get("captions_highlight", "#f59e0b")
            httpx.patch(
                f"{APP_URL}/api/projects/{project_id}",
                json={
                    "captions": {
                        "enabled": True,
                        "size": 5.8 if formato == "shorts" else 4.6,
                        "color": cor_legenda,
                        "highlight": destaque_legenda,
                        "position": pos_legenda,
                    }
                },
                timeout=10,
            )

            # 4. Narração em pt-BR pelo Chatterbox Multilingual
            voz_id = b.get("narration_voice", "oficial")
            ref_wav = os.path.join(RAIZ, "assets", "vozes", "narrador_ptbr_ref.wav")
            if voz_id.startswith("user:"):
                arquivo_user = voz_id.split("user:", 1)[1]
                possivel_wav = os.path.join(RAIZ, "assets", "vozes", arquivo_user)
                if os.path.exists(possivel_wav):
                    ref_wav = possivel_wav

            report("Narração pt-BR", 35, "Sintetizando narração em português brasileiro...")
            cmd_narra = [
                os.path.join(RAIZ, "venv_voice", "Scripts", "python.exe"),
                "-u",
                os.path.join(RAIZ, "tools", "diag", "narrar_pt.py"),
                os.path.join(RAIZ, "projects", project_id),
                "--lang", "pt",
                "--ref", ref_wav,
            ]
            p_narra = subprocess.run(
                cmd_narra,
                cwd=RAIZ,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            if p_narra.returncode != 0:
                _log("Aviso narração pt: " + (p_narra.stdout + p_narra.stderr)[-500:])

            # Revisão de narração com Whisper
            report("Revisão de áudio", 45, "Revisando e aparando sobras de áudio via Whisper...")
            cmd_revisa = [
                os.path.join(RAIZ, ".venv", "Scripts", "python.exe"),
                "-u",
                os.path.join(RAIZ, "tools", "diag", "revisar_narracao.py"),
                os.path.join(RAIZ, "projects", project_id),
            ]
            subprocess.run(
                cmd_revisa,
                cwd=RAIZ,
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # 5. Executar etapas do motor do LeccorTube
            # Voice finish
            report("Acabamento de voz", 50, "Finalizando trilha de voz no motor...")
            httpx.post(f"{APP_URL}/api/projects/{project_id}/run/voice", json={}, timeout=15)
            self._esperar_etapa(project_id, "voice", timeout_sec=120, report_cb=report, check_cancel=is_canceled)

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # Images generation (ComfyUI)
            report("Geração de imagens", 60, "Sintetizando imagens pelo ComfyUI...")
            httpx.post(f"{APP_URL}/api/projects/{project_id}/run/images", json={}, timeout=15)
            self._esperar_etapa(project_id, "images", timeout_sec=600, report_cb=report, check_cancel=is_canceled)

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # Render
            report("Montagem do vídeo", 80, "Renderizando animações, cortes e legendas...")
            httpx.post(f"{APP_URL}/api/projects/{project_id}/run/render", json={}, timeout=15)
            self._esperar_etapa(project_id, "render", timeout_sec=300, report_cb=report, check_cancel=is_canceled)

            if is_canceled():
                job.status = "CANCELED"
                return {"status": "CANCELED"}

            # Export
            report("Exportação MP4", 90, "Exportando vídeo final...")
            httpx.post(f"{APP_URL}/api/projects/{project_id}/run/export", json={}, timeout=15)
            self._esperar_etapa(project_id, "export", timeout_sec=120, report_cb=report, check_cancel=is_canceled)

            # 6. Localizar artefatos exportados
            video_exportado = self._localizar_video_exportado(project_id, titulo)
            job.video_path = video_exportado
            job.thumbnail_path = self._localizar_thumbnail(project_id, video_exportado)

            # 7. Som ambiente (se solicitado)
            som_amb = b.get("ambient_sound", "none")
            if som_amb != "none" and video_exportado and os.path.exists(video_exportado):
                report("Som ambiente", 95, f"Adicionando e masterizando som ambiente '{som_amb}' a -18 LUFS...")
                try:
                    vol = b.get("ambient_volume", 30)
                    item_som = next((i for i in ambiente.lista() if i["id"] == som_amb), None)
                    if item_som:
                        ambiente.mixar(video_exportado, item_som["arquivo"], vol)
                except Exception as e_amb:
                    _log(f"Erro ao mixar som ambiente: {e_amb}")

            # 8. Salvar metadados pt-BR
            self._salvar_metadados_ptbr(video_exportado, b)

            report("Concluído", 100, "Vídeo e artefatos gerados com sucesso!")
            job.status = "COMPLETED"
            return {
                "status": "COMPLETED",
                "video_path": job.video_path,
                "thumbnail_path": job.thumbnail_path,
                "duration_seconds": job.duration_seconds or 60.0,
                "project_id": project_id,
            }

        except Exception as e:
            job.status = "FAILED"
            job.error = str(e)
            _log(f"Falha na geração do job {job.job_id}: {traceback.format_exc()}")
            report("Falha", job.progress, f"Erro: {str(e)[:80]}")
            return {"status": "FAILED", "error": str(e)}

    def _gerar_prompt_ollama(self, texto_pt: str, estilo: str) -> str:
        """Gera prompt em inglês para a cena usando o modelo Qwen2.5-VL via Ollama."""
        try:
            prompt_sistema = (
                f"You are a cinematic AI visual director. "
                f"Given a scene sentence in Portuguese, write a vivid English image generation prompt for Midjourney/Stable Diffusion. "
                f"Style: {estilo}. "
                f"Respond ONLY with the English prompt description (1-2 sentences). Do not include prefixes like 'Prompt:'."
            )
            r = httpx.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": MODELO_IA,
                    "prompt": f"{prompt_sistema}\n\nScene: {texto_pt}\nEnglish prompt:",
                    "stream": False,
                    "options": {"temperature": 0.6, "keep_alive": 0},
                },
                timeout=25,
            )
            if r.status_code == 200:
                resp = r.json().get("response", "").strip()
                resp = re.sub(r"^(prompt\d*:\s*|image:\s*)", "", resp, flags=re.IGNORECASE).strip()
                if resp:
                    return resp
        except Exception as e:
            _log(f"Ollama offline ou erro ({e}); usando prompt descritivo padrão.")

        return f"cinematic scene depicting {texto_pt}, high quality, detailed lighting, {estilo} aesthetic"

    def _esperar_etapa(
        self,
        project_id: str,
        etapa: str,
        timeout_sec: int = 300,
        report_cb: Optional[Callable] = None,
        check_cancel: Optional[Callable[[], bool]] = None,
    ):
        """Aguarda uma etapa do motor do LeccorTube terminar."""
        inicio = time.time()
        while time.time() - inicio < timeout_sec:
            if check_cancel and check_cancel():
                raise RuntimeError("Operação cancelada pelo usuário.")

            try:
                r = httpx.get(f"{APP_URL}/api/projects/{project_id}", timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    st = data.get("status", {})
                    state = st.get("state", "").lower()
                    step = st.get("step", "").lower()
                    msg = st.get("message", "")

                    if state == "idle" and step != etapa:
                        return
                    if state == "failed":
                        raise RuntimeError(f"Etapa {etapa} falhou no motor: {msg}")
                    if report_cb and msg:
                        # Repassar progresso intermediário se houver
                        pass
            except Exception as e:
                _log(f"Consulta status ({etapa}): {e}")

            time.sleep(2)

    def _localizar_video_exportado(self, project_id: str, titulo: str) -> Optional[str]:
        """Localiza o arquivo .mp4 exportado na pasta Videos do usuário ou na pasta do projeto."""
        pasta_videos = os.path.join(os.path.expanduser("~"), "Videos")
        slug = re.sub(r"[^\w\-]+", "-", titulo.lower()).strip("-")[:40]

        # 1. Procurar em subpastas de ~/Videos
        if os.path.exists(pasta_videos):
            for pasta in os.listdir(pasta_videos):
                caminho_pasta = os.path.join(pasta_videos, pasta)
                if os.path.isdir(caminho_pasta) and (slug in pasta or pasta in slug):
                    for arq in os.listdir(caminho_pasta):
                        if arq.endswith(".mp4"):
                            return os.path.join(caminho_pasta, arq)

        # 2. Procurar no projeto
        pasta_proj = os.path.join(RAIZ, "projects", project_id, "output")
        if os.path.exists(pasta_proj):
            final = os.path.join(pasta_proj, "final.mp4")
            if os.path.exists(final):
                return final

        return None

    def _localizar_thumbnail(self, project_id: str, video_path: Optional[str]) -> Optional[str]:
        """Localiza thumbnail gerada para o vídeo."""
        if video_path:
            pasta_video = os.path.dirname(video_path)
            for arq in os.listdir(pasta_video):
                if arq.lower().endswith((".jpg", ".png", ".webp")) and "thumb" in arq.lower():
                    return os.path.join(pasta_video, arq)

        pasta_proj = os.path.join(RAIZ, "projects", project_id, "output")
        if os.path.exists(pasta_proj):
            for arq in os.listdir(pasta_proj):
                if arq.lower().endswith((".jpg", ".png", ".webp")):
                    return os.path.join(pasta_proj, arq)

        return None

    def _salvar_metadados_ptbr(self, video_path: Optional[str], brief: Dict[str, Any]):
        if not video_path:
            return
        pasta = os.path.dirname(video_path)
        caminho_txt = os.path.join(pasta, "youtube_metadata_ptbr.txt")
        titulo = brief.get("title", "")
        desc = brief.get("description", "")
        tags = ", ".join(brief.get("tags", []))
        hashtags = " ".join(f"#{h.strip('#')}" for h in brief.get("hashtags", []))

        conteudo = f"""TÍTULO:
{titulo}

DESCRIÇÃO:
{desc}

{hashtags}

TAGS:
{tags}
"""
        with open(caminho_txt, "w", encoding="utf-8") as f:
            f.write(conteudo)


# Instância singleton
video_adapter = VideoGenerationAdapter()
