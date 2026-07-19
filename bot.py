"""
All Media Downloader — Telegram bot entrypoint.

Downloads TikTok, Instagram, and Facebook videos via an external API
(no yt-dlp or scraping done here). Run with: python bot.py

Deployed on Render as a Web Service (free plan has no free Background
Worker option), so this also starts a tiny Flask keep-alive server on
$PORT in a background thread. Point an UptimeRobot HTTP(s) monitor at
the service URL (e.g. every 5 minutes) to stop it from sleeping.
"""

import asyncio
import logging
import os
import sys
import threading
import time

from flask import Flask
from telegram.error import Conflict
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from admin import admin_callback, admin_command, broadcast_command
from config import BOT_TOKEN
from handlers import about_command, handle_message, start_command

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("werkzeug").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# --- Keep-alive web server (for Render Web Service + UptimeRobot) ---
keepalive_app = Flask(__name__)


@keepalive_app.route("/")
def home():
    return "All Media Downloader bot is alive.", 200


@keepalive_app.route("/health")
def health():
    return {"status": "ok"}, 200


def run_keepalive_server() -> None:
    port = int(os.environ.get("PORT", 8080))
    keepalive_app.run(host="0.0.0.0", port=port)


def main() -> None:
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN environment variable is not set. Exiting.")
        sys.exit(1)

    # Start the Flask keep-alive server in a background thread so Render
    # sees an open port immediately, while the bot polls in the main thread.
    threading.Thread(target=run_keepalive_server, daemon=True).start()

    # Explicitly create/set an event loop on the main thread. Newer Python
    # versions no longer auto-create one, which run_polling() relies on.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("about", about_command))
    application.add_handler(CommandHandler("admin", admin_command))
    application.add_handler(CommandHandler("broadcast", broadcast_command))
    application.add_handler(CallbackQueryHandler(admin_callback, pattern=r"^admin:"))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("All Media Downloader bot starting...")

    # If another instance (e.g. a previous deploy still shutting down, or a
    # duplicate service accidentally running elsewhere) is polling with the
    # same BOT_TOKEN, Telegram raises Conflict and python-telegram-bot lets
    # run_polling() crash outright — which on Render just triggers an
    # auto-restart into the same Conflict, over and over. drop_pending_updates
    # clears any stale getUpdates session on our own start, and the retry
    # loop below absorbs a transient Conflict (e.g. the old instance hasn't
    # finished shutting down yet) instead of crash-looping.
    max_attempts = 5
    for attempt in range(1, max_attempts + 1):
        try:
            application.run_polling(
                allowed_updates=["message", "callback_query"],
                drop_pending_updates=True,
            )
            break
        except Conflict:
            if attempt == max_attempts:
                logger.error(
                    "Another bot instance is running with the same BOT_TOKEN "
                    "and would not yield after %d attempts. Only one instance "
                    "can poll at a time — stop the other deployment/service "
                    "using this token.",
                    max_attempts,
                )
                raise
            wait_seconds = min(5 * attempt, 20)
            logger.warning(
                "Conflict: another instance is polling with this BOT_TOKEN "
                "(attempt %d/%d). Retrying in %ds...",
                attempt,
                max_attempts,
                wait_seconds,
            )
            time.sleep(wait_seconds)


if __name__ == "__main__":
    main()
