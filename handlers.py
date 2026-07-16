"""
Telegram bot handlers: /start command and incoming link messages.
"""

import logging
import re

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


# Telegram hard-limits media captions to 1024 characters (server-enforced,
# not something the bot can raise). We only trim the raw API caption text
# itself if the combined message would exceed that; platform/size/duration
# are never cut.
TELEGRAM_CAPTION_LIMIT = 1024

# We use MarkdownV2 (not legacy Markdown) so the caption text can be wrapped
# in a ``` code block ``` — tapping/holding a code block in Telegram copies
# it to the clipboard, which is what gives the "tap caption to copy" effect.
# MarkdownV2 requires ALL of these reserved characters to be escaped outside
# of code blocks, or Telegram throws "Can't parse entities" and the whole
# send fails (this was the root cause of earlier silent failures too).
_MDV2_SPECIAL_CHARS = set(r"_*[]()~`>#+-=|{}.!\\")


def _escape_mdv2(text: str) -> str:
    return "".join("\\" + ch if ch in _MDV2_SPECIAL_CHARS else ch for ch in text)


def _escape_mdv2_code(text: str) -> str:
    # Inside a ``` code block, only backtick and backslash need escaping.
    return text.replace("\\", "\\\\").replace("`", "\\`")


def _build_caption(result: dict) -> str:
    platform = _escape_mdv2(str(result.get("platform", "unknown")).title())
    size = _escape_mdv2(str(result.get("size", "unknown")))
    duration = _escape_mdv2(str(result.get("duration", "unknown")))
    raw_caption = (result.get("caption") or "").strip()

    meta = (
        f"📹 *Platform:* {platform}\n"
        f"📦 *Size:* {size}\n"
        f"⏱ *Duration:* {duration}"
    )

    if not raw_caption:
        return meta

    header = "📝 *Caption* \\(tap to copy\\):\n"

    def wrap(text: str) -> str:
        return f"{header}```\n{_escape_mdv2_code(text)}\n```\n\n{meta}"

    full = wrap(raw_caption)

    if len(full) <= TELEGRAM_CAPTION_LIMIT:
        return full

    # Only the caption text is shortened, and only when Telegram's own
    # limit forces it — platform/size/duration always stay intact.
    fixed_len = len(wrap(""))
    room = max(TELEGRAM_CAPTION_LIMIT - fixed_len - 1, 0)
    trimmed = raw_caption[:room].rstrip() + "…" if room < len(raw_caption) else raw_caption
    return wrap(trimmed)


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
        tmp_path = download_video(video_url, platform=result.get("platform", ""))

        caption = _build_caption(result)

        with open(tmp_path, "rb") as video_file:
            try:
                await message.reply_video(
                    video=video_file,
                    caption=caption,
                    parse_mode="MarkdownV2",
                    supports_streaming=True,
                )
            except Exception as md_exc:
                logger.warning(
                    "MarkdownV2 caption send failed (%s), retrying as plain text", md_exc
                )
                video_file.seek(0)
                # Strip MarkdownV2 escaping/formatting chars for a safe plain fallback.
                plain_caption = re.sub(r"\\([_*\[\]()~`>#+\-=|{}.!])", r"\1", caption)
                plain_caption = plain_caption.replace("```", "").replace("*", "")
                await message.reply_video(
                    video=video_file,
                    caption=plain_caption,
                    supports_streaming=True,
                )

        await status_message.delete()

        if user:
            database.record_download(user.id, result.get("platform", "unknown"))

    except VideoTooLargeError as exc:
        await status_message.edit_text(f"❌ {exc}")
    except VideoDownloadError as exc:
        await status_message.edit_text(f"❌ {exc}")
    except Exception as exc:
        logger.exception(
            "Unexpected error while sending video (platform=%s, url=%s): %s",
            result.get("platform", "unknown"),
            video_url,
            exc,
        )
        await status_message.edit_text(
            f"❌ An unexpected error occurred while sending the video.\n\nDetail: {exc}\n\nPlease try again."
        )
    finally:
        if tmp_path:
            import os

            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except OSError:
                logger.warning("Failed to delete temp file after sending: %s", tmp_path)
