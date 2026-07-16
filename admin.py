"""
Admin panel for the All Media Downloader bot.

Provides:
  /admin      — inline panel with stats, refresh, and broadcast entry point
  /broadcast  — send a message to every known user (admin only)

Access is restricted to the Telegram user ID(s) listed in config.ADMIN_IDS.
"""

import asyncio
import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

import database
from config import ADMIN_IDS

logger = logging.getLogger(__name__)

# Tracks which admins are currently expected to send a broadcast message next.
_awaiting_broadcast: set[int] = set()


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def _admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📊 Stats", callback_data="admin:stats")],
            [InlineKeyboardButton("🔄 Refresh", callback_data="admin:refresh")],
            [InlineKeyboardButton("📣 Broadcast", callback_data="admin:broadcast")],
        ]
    )


def _format_stats_text() -> str:
    stats = database.get_stats()
    lines = [
        "🛠 *Admin Panel*",
        "",
        f"👥 *Total Users:* {stats['total_users']}",
        f"⬇️ *Total Downloads:* {stats['total_downloads']}",
    ]
    breakdown = stats["downloads_by_platform"]
    if breakdown:
        lines.append("")
        lines.append("*By platform:*")
        for platform, count in sorted(breakdown.items(), key=lambda kv: -kv[1]):
            lines.append(f"  • {platform.title()}: {count}")
    return "\n".join(lines)


async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or not is_admin(user.id):
        await update.message.reply_text("⛔ This command is restricted to admins.")
        return

    await update.message.reply_text(
        _format_stats_text(),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=_admin_keyboard(),
    )


async def admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user

    if not user or not is_admin(user.id):
        await query.answer("⛔ Not authorized.", show_alert=True)
        return

    action = query.data.split(":", 1)[1] if ":" in query.data else ""

    if action in ("stats", "refresh"):
        await query.answer("Refreshed ✅" if action == "refresh" else None)
        await query.edit_message_text(
            _format_stats_text(),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=_admin_keyboard(),
        )

    elif action == "broadcast":
        _awaiting_broadcast.add(user.id)
        await query.answer()
        await query.edit_message_text(
            "📣 *Broadcast mode*\n\n"
            "Send the message you want to broadcast to all users as your "
            "next message, or send /cancel to abort.",
            parse_mode=ParseMode.MARKDOWN,
        )
    else:
        await query.answer()


async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /broadcast <text> directly, as an alternative to the button flow."""
    user = update.effective_user
    if not user or not is_admin(user.id):
        await update.message.reply_text("⛔ This command is restricted to admins.")
        return

    text = " ".join(context.args) if context.args else ""
    if not text:
        _awaiting_broadcast.add(user.id)
        await update.message.reply_text(
            "📣 Send the message you want to broadcast as your next message, "
            "or send /cancel to abort."
        )
        return

    await _send_broadcast(update, context, text)


async def handle_broadcast_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    Call this from the general text handler BEFORE link processing.
    Returns True if the message was consumed as a broadcast payload.
    """
    user = update.effective_user
    message = update.message

    if not user or not message or user.id not in _awaiting_broadcast:
        return False

    _awaiting_broadcast.discard(user.id)

    if message.text and message.text.strip() == "/cancel":
        await message.reply_text("❌ Broadcast cancelled.")
        return True

    await _send_broadcast(update, context, message.text or "")
    return True


async def _send_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    if not text.strip():
        await update.effective_message.reply_text("⚠️ Broadcast message was empty. Cancelled.")
        return

    user_ids = database.get_all_user_ids()
    status = await update.effective_message.reply_text(
        f"📣 Broadcasting to {len(user_ids)} users..."
    )

    sent, failed = 0, 0
    for uid in user_ids:
        try:
            await context.bot.send_message(chat_id=uid, text=text)
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)  # gentle rate limiting

    await status.edit_text(f"✅ Broadcast finished.\nSent: {sent} | Failed: {failed}")
