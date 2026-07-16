"""
Configuration for the All Media Downloader Telegram bot.
All values can be overridden via environment variables.
"""

import os

# Required: your Telegram bot token from @BotFather
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")

# Telegram user ID(s) allowed to use /admin and /broadcast.
# Hardcoded as requested; you can still add more via the ADMIN_IDS env var
# (comma-separated) without touching this file.
ADMIN_IDS = {8279574441}
_extra_admin_ids = os.environ.get("ADMIN_IDS", "")
if _extra_admin_ids:
    ADMIN_IDS.update(
        int(uid.strip()) for uid in _extra_admin_ids.split(",") if uid.strip().isdigit()
    )

# API credentials / base URL (defaults match the All Media Downloader API)
API_KEY = os.environ.get("API_KEY", "m41nul")
API_BASE_URL = os.environ.get(
    "API_BASE_URL", "https://all-media-downloader-api.onrender.com"
)
API_DOWNLOAD_ENDPOINT = f"{API_BASE_URL}/api/download"

# Telegram bot upload limit for videos sent via python-telegram-bot (bot API)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# Timeouts (seconds)
API_REQUEST_TIMEOUT = 30
DOWNLOAD_TIMEOUT = 60

# Chunk size for streaming video download
DOWNLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MB
