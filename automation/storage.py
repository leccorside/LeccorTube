"""Camada de persistência local em SQLite thread-safe para o LeccorTubeAgent."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional

from automation.models import (
    AGENTS_METADATA,
    AgentState,
    Batch,
    Opportunity,
    QAChecklist,
    VideoBrief,
    VideoItem,
    YouTubeChannel,
)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "automation.db")


class Storage:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._lock = threading.RLock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self):
        with self._lock, self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                handle TEXT DEFAULT '',
                subscribers_count INTEGER DEFAULT 0,
                thumbnail_url TEXT DEFAULT '',
                is_authenticated INTEGER DEFAULT 1,
                mode TEXT DEFAULT 'assisted',
                default_niche TEXT DEFAULT 'tecnologia',
                default_subniche TEXT DEFAULT '',
                default_format TEXT DEFAULT 'shorts',
                publication_policy TEXT DEFAULT 'draft',
                max_videos_per_day INTEGER DEFAULT 3,
                daily_budget_usd REAL DEFAULT 20.0,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS batches (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                niche TEXT NOT NULL,
                subniche TEXT DEFAULT '',
                format TEXT DEFAULT 'shorts',
                video_count INTEGER DEFAULT 3,
                mode TEXT DEFAULT 'assisted',
                status TEXT DEFAULT 'CREATED',
                current_video_id TEXT,
                produced_count INTEGER DEFAULT 0,
                published_count INTEGER DEFAULT 0,
                queued_count INTEGER DEFAULT 0,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS batch_videos (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                index_in_batch INTEGER DEFAULT 1,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'IDEA_DISCOVERED',
                current_agent_order INTEGER DEFAULT 1,
                overall_progress INTEGER DEFAULT 0,
                estimated_seconds_remaining INTEGER DEFAULT 1080,
                brief_json TEXT NOT NULL,
                agents_json TEXT NOT NULL,
                qa_json TEXT,
                artifacts_json TEXT,
                publication_json TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY (batch_id) REFERENCES batches(id)
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT,
                video_id TEXT,
                agent_order INTEGER,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                data_json TEXT,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS experiments (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                hypothesis TEXT NOT NULL,
                variable TEXT NOT NULL,
                status TEXT DEFAULT 'ACTIVE',
                samples_count INTEGER DEFAULT 0,
                result_notes TEXT DEFAULT '',
                created_at REAL NOT NULL
            );
            """)

            # Inserir canais padrão caso não existam
            cur = conn.execute("SELECT COUNT(*) as count FROM channels")
            if cur.fetchone()["count"] == 0:
                canais_padrao = [
                    ("techfuture", "TechFuture AI (Principal)", "@techfuture_ai", 420000, "", 1, "assisted", "tecnologia", "Computação Quântica", "shorts", "draft", 3, 20.0, time.time()),
                    ("curiosomaster", "CuriosoMaster (Dark/Shorts)", "@curiosomaster", 185000, "", 1, "assisted", "curiosidades", "Fatos Ocultos", "shorts", "draft", 3, 20.0, time.time()),
                    ("mindmoney", "Mind & Money (Finanças)", "@mindmoney", 92000, "", 1, "assisted", "financas", "Criptomoedas", "shorts", "draft", 2, 20.0, time.time()),
                    ("darktales", "Contos Obscuros (Terror)", "@darktales", 310000, "", 1, "assisted", "terror", "Lendas Urbanas", "shorts", "draft", 3, 20.0, time.time()),
                ]
                conn.executemany("""
                INSERT INTO channels (id, title, handle, subscribers_count, thumbnail_url, is_authenticated, mode, default_niche, default_subniche, default_format, publication_policy, max_videos_per_day, daily_budget_usd, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, canais_padrao)

    # ==================== CANAIS ====================

    def list_channels(self) -> List[YouTubeChannel]:
        with self._lock, self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM channels ORDER BY subscribers_count DESC").fetchall()
            return [
                YouTubeChannel(
                    id=r["id"],
                    title=r["title"],
                    handle=r["handle"],
                    subscribers_count=r["subscribers_count"],
                    thumbnail_url=r["thumbnail_url"],
                    is_authenticated=bool(r["is_authenticated"]),
                    mode=r["mode"],
                    default_niche=r["default_niche"],
                    default_subniche=r["default_subniche"],
                    default_format=r["default_format"],
                    publication_policy=r["publication_policy"],
                    max_videos_per_day=r["max_videos_per_day"],
                    daily_budget_usd=r["daily_budget_usd"],
                    created_at=r["created_at"],
                )
                for r in rows
            ]

    def get_channel(self, channel_id: str) -> Optional[YouTubeChannel]:
        with self._lock, self._get_connection() as conn:
            r = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
            if not r:
                return None
            return YouTubeChannel(
                id=r["id"],
                title=r["title"],
                handle=r["handle"],
                subscribers_count=r["subscribers_count"],
                thumbnail_url=r["thumbnail_url"],
                is_authenticated=bool(r["is_authenticated"]),
                mode=r["mode"],
                default_niche=r["default_niche"],
                default_subniche=r["default_subniche"],
                default_format=r["default_format"],
                publication_policy=r["publication_policy"],
                max_videos_per_day=r["max_videos_per_day"],
                daily_budget_usd=r["daily_budget_usd"],
                created_at=r["created_at"],
            )

    def save_channel(self, ch: YouTubeChannel):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
            INSERT INTO channels (id, title, handle, subscribers_count, thumbnail_url, is_authenticated, mode, default_niche, default_subniche, default_format, publication_policy, max_videos_per_day, daily_budget_usd, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                handle=excluded.handle,
                subscribers_count=excluded.subscribers_count,
                thumbnail_url=excluded.thumbnail_url,
                is_authenticated=excluded.is_authenticated,
                mode=excluded.mode,
                default_niche=excluded.default_niche,
                default_subniche=excluded.default_subniche,
                default_format=excluded.default_format,
                publication_policy=excluded.publication_policy,
                max_videos_per_day=excluded.max_videos_per_day,
                daily_budget_usd=excluded.daily_budget_usd
            """, (
                ch.id, ch.title, ch.handle, ch.subscribers_count, ch.thumbnail_url,
                1 if ch.is_authenticated else 0, ch.mode, ch.default_niche,
                ch.default_subniche, ch.default_format, ch.publication_policy,
                ch.max_videos_per_day, ch.daily_budget_usd, ch.created_at
            ))

    def delete_channel(self, channel_id: str) -> bool:
        with self._lock, self._get_connection() as conn:
            cur = conn.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
            return cur.rowcount > 0

    # ==================== BATCHES ====================

    def save_batch(self, batch: Batch):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
            INSERT INTO batches (id, channel_id, niche, subniche, format, video_count, mode, status, current_video_id, produced_count, published_count, queued_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                current_video_id=excluded.current_video_id,
                produced_count=excluded.produced_count,
                published_count=excluded.published_count,
                queued_count=excluded.queued_count,
                updated_at=excluded.updated_at
            """, (
                batch.id, batch.channel_id, batch.niche, batch.subniche, batch.format,
                batch.video_count, batch.mode, batch.status, batch.current_video_id,
                batch.produced_count, batch.published_count, batch.queued_count,
                batch.created_at, batch.updated_at
            ))

    def get_batch(self, batch_id: str) -> Optional[Batch]:
        with self._lock, self._get_connection() as conn:
            r = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
            if not r:
                return None
            return Batch(
                id=r["id"],
                channel_id=r["channel_id"],
                niche=r["niche"],
                subniche=r["subniche"],
                format=r["format"],
                video_count=r["video_count"],
                mode=r["mode"],
                status=r["status"],
                current_video_id=r["current_video_id"],
                produced_count=r["produced_count"],
                published_count=r["published_count"],
                queued_count=r["queued_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )

    def get_latest_batch(self) -> Optional[Batch]:
        with self._lock, self._get_connection() as conn:
            r = conn.execute("SELECT * FROM batches ORDER BY created_at DESC LIMIT 1").fetchone()
            if not r:
                return None
            return Batch(
                id=r["id"],
                channel_id=r["channel_id"],
                niche=r["niche"],
                subniche=r["subniche"],
                format=r["format"],
                video_count=r["video_count"],
                mode=r["mode"],
                status=r["status"],
                current_video_id=r["current_video_id"],
                produced_count=r["produced_count"],
                published_count=r["published_count"],
                queued_count=r["queued_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )

    # ==================== VÍDEOS ====================

    def save_video(self, video: VideoItem):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
            INSERT INTO batch_videos (id, batch_id, index_in_batch, title, status, current_agent_order, overall_progress, estimated_seconds_remaining, brief_json, agents_json, qa_json, artifacts_json, publication_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                status=excluded.status,
                current_agent_order=excluded.current_agent_order,
                overall_progress=excluded.overall_progress,
                estimated_seconds_remaining=excluded.estimated_seconds_remaining,
                brief_json=excluded.brief_json,
                agents_json=excluded.agents_json,
                qa_json=excluded.qa_json,
                artifacts_json=excluded.artifacts_json,
                publication_json=excluded.publication_json,
                updated_at=excluded.updated_at
            """, (
                video.id, video.batch_id, video.index_in_batch, video.title, video.status,
                video.current_agent_order, video.overall_progress, video.estimated_seconds_remaining,
                video.brief.model_dump_json(),
                json.dumps([a.model_dump() for a in video.agents]),
                video.qa.model_dump_json() if video.qa else None,
                json.dumps(video.artifacts),
                json.dumps(video.publication),
                video.created_at, video.updated_at
            ))

    def get_video(self, video_id: str) -> Optional[VideoItem]:
        with self._lock, self._get_connection() as conn:
            r = conn.execute("SELECT * FROM batch_videos WHERE id = ?", (video_id,)).fetchone()
            if not r:
                return None
            return self._row_to_video(r)

    def list_videos_by_batch(self, batch_id: str) -> List[VideoItem]:
        with self._lock, self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM batch_videos WHERE batch_id = ? ORDER BY index_in_batch ASC", (batch_id,)).fetchall()
            return [self._row_to_video(r) for r in rows]

    def _row_to_video(self, r: sqlite3.Row) -> VideoItem:
        brief_data = json.loads(r["brief_json"])
        agents_data = json.loads(r["agents_json"])
        qa_data = json.loads(r["qa_json"]) if r["qa_json"] else None
        artifacts_data = json.loads(r["artifacts_json"]) if r["artifacts_json"] else {}
        pub_data = json.loads(r["publication_json"]) if r["publication_json"] else {}

        return VideoItem(
            id=r["id"],
            batch_id=r["batch_id"],
            index_in_batch=r["index_in_batch"],
            title=r["title"],
            status=r["status"],
            current_agent_order=r["current_agent_order"],
            overall_progress=r["overall_progress"],
            estimated_seconds_remaining=r["estimated_seconds_remaining"],
            brief=VideoBrief(**brief_data),
            agents=[AgentState(**a) for a in agents_data],
            qa=QAChecklist(**qa_data) if qa_data else None,
            artifacts=artifacts_data,
            publication=pub_data,
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )

    # ==================== EVENTOS E TELEMETRIA ====================

    def log_event(self, batch_id: Optional[str], video_id: Optional[str], agent_order: Optional[int], event_type: str, message: str, data: Optional[Dict[str, Any]] = None):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
            INSERT INTO events (batch_id, video_id, agent_order, event_type, message, data_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                batch_id, video_id, agent_order, event_type, message,
                json.dumps(data) if data else None, time.time()
            ))

    def list_events(self, batch_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            if batch_id:
                rows = conn.execute("SELECT * FROM events WHERE batch_id = ? ORDER BY id DESC LIMIT ?", (batch_id, limit)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return [
                {
                    "id": r["id"],
                    "batch_id": r["batch_id"],
                    "video_id": r["video_id"],
                    "agent_order": r["agent_order"],
                    "event_type": r["event_type"],
                    "message": r["message"],
                    "data": json.loads(r["data_json"]) if r["data_json"] else None,
                    "created_at": r["created_at"]
                }
                for r in rows
            ]

    # ==================== EXPERIMENTOS E APRENDIZADO ====================

    def list_experiments(self, channel_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            if channel_id:
                rows = conn.execute("SELECT * FROM experiments WHERE channel_id = ? ORDER BY created_at DESC", (channel_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM experiments ORDER BY created_at DESC").fetchall()
            return [dict(r) for r in rows]

    def add_experiment(self, exp_id: str, channel_id: str, hypothesis: str, variable: str, result_notes: str = ""):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
            INSERT INTO experiments (id, channel_id, hypothesis, variable, status, samples_count, result_notes, created_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                samples_count=samples_count+1,
                result_notes=excluded.result_notes
            """, (exp_id, channel_id, hypothesis, variable, result_notes, time.time()))


# Instância singleton para uso por todos os módulos
storage = Storage()
