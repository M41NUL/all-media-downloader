/**
 * ============================================
 * All Media Downloader Bot - Admin Panel
 * ============================================
 * Developer : Md. Mainul Islam
 * Owner     : MAINUL - X
 * Telegram  : https://t.me/mdmainulislaminfo
 * GitHub    : https://github.com/M41NUL
 * WhatsApp  : +8801308850528
 * Channel   : https://t.me/mainul_x_official
 * Group     : https://t.me/mainul_x_official_gc
 * Email     : githubmainul@gmail.com | devmainulislam@gmail.com
 * YouTube   : https://youtube.com/@mdmainulislaminfo
 * License   : MIT License
 * ============================================
 */

'use strict';

const { Markup } = require('telegraf');
const { ADMIN_ID } = require('./config');
const db           = require('./database');
const { escMd }    = require('./buttons');

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAdmin(ctx) {
  return ADMIN_ID && String(ctx.from?.id) === String(ADMIN_ID);
}

// ── Admin panel message ───────────────────────────────────────────────────────

function buildPanel() {
  const s     = db.getStats();
  const lines = [`👥 *Total Users:* ${s.totalUsers}`];

  // List users (max 20 to avoid huge messages)
  const userList = Object.values(s.users).slice(0, 20);
  userList.forEach((u, i) => {
    const uname = u.username ? `@${escMd(u.username)}` : escMd(u.firstName);
    lines.push(`  ${i + 1}\\. ${uname} — ${u.downloads} DL`);
  });
  if (s.totalUsers > 20) lines.push(`  _\\.\\.\\. and ${s.totalUsers - 20} more_`);

  lines.push('');
  lines.push(`📥 *Total Downloads:* ${s.totalDownloads}`);
  lines.push('');
  lines.push('📊 *Platform Stats:*');
  lines.push(`  🎵 TikTok:    ${s.tiktok}`);
  lines.push(`  📸 Instagram: ${s.instagram}`);
  lines.push(`  📘 Facebook:  ${s.facebook}`);

  return lines.join('\n');
}

// ── Broadcast state (in-memory) ───────────────────────────────────────────────

const broadcastState = new Map(); // userId → true (waiting for broadcast message)

// ── Register admin handlers ───────────────────────────────────────────────────

function registerAdmin(bot) {

  // /admin command
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ You are not authorised to use this command.');
    }

    const panel = buildPanel();
    await ctx.replyWithMarkdownV2(
      `🛠️ *Admin Panel*\n\n${panel}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📣 Broadcast', 'admin_broadcast')],
        [Markup.button.callback('🔄 Refresh',   'admin_refresh')],
      ])
    );
  });

  // Refresh panel
  bot.action('admin_refresh', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    await ctx.answerCbQuery('Refreshed ✅');
    try {
      await ctx.editMessageText(
        `🛠️ *Admin Panel*\n\n${buildPanel()}`,
        {
          parse_mode   : 'MarkdownV2',
          reply_markup : Markup.inlineKeyboard([
            [Markup.button.callback('📣 Broadcast', 'admin_broadcast')],
            [Markup.button.callback('🔄 Refresh',   'admin_refresh')],
          ]).reply_markup,
        }
      );
    } catch (_) {}
  });

  // Broadcast prompt
  bot.action('admin_broadcast', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    await ctx.answerCbQuery();
    broadcastState.set(String(ctx.from.id), true);
    await ctx.reply('📣 Send the message you want to broadcast to all users:');
  });

  // Broadcast execution (handled in main bot message pipeline — see bot.js)
}

/**
 * Called from bot.js to check & execute broadcast.
 * Returns true if the message was consumed as a broadcast.
 */
async function handleBroadcast(ctx, bot) {
  const uid = String(ctx.from?.id);
  if (!broadcastState.get(uid)) return false;

  broadcastState.delete(uid);

  const text  = ctx.message?.text;
  if (!text) return false;

  const users = db.getAllUsers();
  let sent = 0, failed = 0;

  const statusMsg = await ctx.reply(`📣 Broadcasting to ${users.length} users…`);

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.id, text);
      sent++;
    } catch (_) {
      failed++;
    }
    // Slight throttle to respect Telegram rate limits
    await new Promise(r => setTimeout(r, 35));
  }

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, undefined,
      `✅ Broadcast complete\\!\n📤 Sent: *${sent}*\n❌ Failed: *${failed}*`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (_) {}

  return true;
}

module.exports = { registerAdmin, handleBroadcast, isAdmin };
