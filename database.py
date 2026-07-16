"""
Lightweight JSON-based persistence for users and download stats.
No external DB needed — good fit for Render free plan.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("DB_PATH", "database.json")
_lock = threading.Lock()

_DEFAULT_DB = {
    "users": {},       # str(user_id) -> {"username", "first_name", "joined_at", "downloads"}
    "total_downloads": 0,
    "downloads_by_platform": {},  # "tiktok" -> count
}


def _load() -> dict:
    if not os.path.exists(DB_PATH):
        return json.loads(json.dumps(_DEFAULT_DB))
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for key, value in _DEFAULT_DB.items():
            data.setdefault(key, value)
        return data
    except (json.JSONDecodeError, OSError):
        logger.warning("database.json unreadable, starting fresh")
        return json.loads(json.dumps(_DEFAULT_DB))


def _save(data: dict) -> None:
    tmp_path = f"{DB_PATH}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, DB_PATH)


def register_user(user_id: int, username: str | None, first_name: str | None) -> None:
    """Add a user to the database if not already present."""
    with _lock:
        data = _load()
        uid = str(user_id)
        if uid not in data["users"]:
            data["users"][uid] = {
                "username": username or "",
                "first_name": first_name or "",
                "joined_at": datetime.now(timezone.utc).isoformat(),
                "downloads": 0,
            }
            _save(data)


def record_download(user_id: int, platform: str) -> None:
    """Increment download counters for a user and a platform."""
    with _lock:
        data = _load()
        uid = str(user_id)
        if uid not in data["users"]:
            data["users"][uid] = {
                "username": "",
                "first_name": "",
                "joined_at": datetime.now(timezone.utc).isoformat(),
                "downloads": 0,
            }
        data["users"][uid]["downloads"] += 1
        data["total_downloads"] += 1
        platform_key = (platform or "unknown").lower()
        data["downloads_by_platform"][platform_key] = (
            data["downloads_by_platform"].get(platform_key, 0) + 1
        )
        _save(data)


def get_stats() -> dict:
    """Return overall stats: total users, total downloads, per-platform breakdown."""
    with _lock:
        data = _load()
        return {
            "total_users": len(data["users"]),
            "total_downloads": data["total_downloads"],
            "downloads_by_platform": dict(data["downloads_by_platform"]),
        }


def get_all_user_ids() -> list[int]:
    """Return every known user's Telegram ID, for broadcast."""
    with _lock:
        data = _load()
        return [int(uid) for uid in data["users"].keys()]
