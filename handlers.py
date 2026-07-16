"""
Telegram bot handlers: /start command and incoming link messages.
"""

import logging

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ContextTypes

from admin import handle_broadcast_message
from api_client import fetch_video_info
import database
import developer_info
from platform_detect import get_supported_url, is_supported_link
from video_handler import VideoDownloadError, VideoTooLargeError, download_video

logger = logging.getLogger(__name__)

WELCOME_MESSAGE = (
    "👋 Welcome to *All Media Downloader*!\n\n"
    "Send me a video link from any of these platforms and I'll download it for you:\n\n"
    "🎵 TikTok\n"
    "📸 Instagram\n"
    "📘 Facebook\n\n"
    "Just paste the link here and I'll take care of the rest."
)

INVALID_LINK_MESSAGE = (
    "⚠️ I couldn't find a supported link in your message.\n\n"
    "Please send a valid *TikTok*, *Instagram*, or *Facebook* video link."
)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user:
        database.register_user(user.id, user.username, user.first_name)
    await update.message.reply_text(WELCOME_MESSAGE, parse_mode="Markdown")


async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🤖 *All Media Downloader*\n\n"
        f"👨‍💻 *Developer:* {developer_info.AUTHOR}\n"
        f"🏷 *Owner:* {developer_info.OWNER}\n"
        f"🐙 *GitHub:* [{developer_info.GITHUB}]({developer_info.GITHUB_URL})\n"
        f"📢 *Channel:* {developer_info.TELEGRAM_CHANNEL}\n"
        f"👥 *Group:* {developer_info.TELEGRAM_GROUP}\n"
        f"📧 *Email:* {developer_info.EMAIL}\n"
        f"📺 *YouTube:* {developer_info.YOUTUBE}\n\n"
        f"{developer_info.COPYRIGHT}"
    )
    await update.message.reply_text(text, parse_mode="Markdown", disable_web_page_preview=True)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.message
    if not message or not message.text:
        return

    # If an admin is mid-broadcast, this message is the broadcast payload,
    # not a link to download.
    if await handle_broadcast_message(update, context):
        return

    user = update.effective_user
    if user:
        database.register_user(user.id, user.username, user.first_name)

    text = message.text

    if not is_supported_link(text):
        await message.reply_text(INVALID_LINK_MESSAGE, parse_mode="Markdown")
        return

    url = get_supported_url(text)

    status_message = await message.reply_text("⏳ Processing your link, please wait...")

    # Fetch video info from the external API
    result = fetch_video_info(url)

    if not result.get("success"):
        error_text = result.get("error", "Something went wrong. Please try again.")
        await status_message.edit_text(f"❌ Failed to process this link.\n\nReason: {error_text}")
        return

    video_url = result.get("video_url")
    if not video_url:
        await status_message.edit_text(
            "❌ The download service didn't return a video link. Please try again."
        )
        return

    await context.bot.send_chat_action(chat_id=message.chat_id, action=ChatAction.UPLOAD_VIDEO)

    tmp_path = None
    try:
        tmp_path = download_video(video_url)

        caption = (
            f"📹 *Platform:* {result.get('platform', 'unknown').title()}\n"
            f"📦 *Size:* {result.get('size', 'unknown')}\n"
            f"⏱ *Duration:* {result.get('duration', 'unknown')}"
        )

        with open(tmp_path, "rb") as video_file:
            await message.reply_video(
                video=video_file,
                caption=caption,
                parse_mode="Markdown",
                supports_streaming=True,
            )

        await status_message.delete()

        if user:
            database.record_download(user.id, result.get("platform", "unknown"))

    except VideoTooLargeError as exc:
        await status_message.edit_text(f"❌ {exc}")
    except VideoDownloadError as exc:
        await status_message.edit_text(f"❌ {exc}")
    except Exception:
        logger.exception("Unexpected error while sending video")
        await status_message.edit_text(
            "❌ An unexpected error occurred while sending the video. Please try again."
        )
    finally:
        if tmp_path:
            import os

            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except OSError:
                logger.warning("Failed to delete temp file after sending: %s", tmp_path)
