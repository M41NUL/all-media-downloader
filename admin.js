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
const db = require('./database');

// ── MarkdownV2 safe escape (inline — no dependency on buttons.js) ─────────────
function esc(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function isAdmin(ctx) {
  if (!ADMIN_ID) return false;
  return String(ctx.from?.id) === String(ADMIN_ID);
}

// ── Admin keyboard ────────────────────────────────────────────────────────────
const ADMIN_KB = () => Markup.inlineKeyboard([
  [
    Markup.button.callback('🔄 Refresh',   'admin_refresh'),
    Markup.button.callback('📣 Broadcast', 'admin_broadcast'),
  ],
  [
    Markup.button.callback('👥 User List', 'admin_users'),
    Markup.button.callback('📊 Stats',     'admin_stats'),
  ],
]);

// ── Panel builder — plain text (safe, no MarkdownV2 parse errors) ─────────────
function buildPanelText() {
  try {
    const s = db.getStats();
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });

    let msg = '';
    msg += `🛠 Admin Panel\n`;
    msg += `🕐 ${now} (BD)\n`;
    msg += `${'─'.repeat(30)}\n\n`;

    msg += `📊 STATISTICS\n`;
    msg += `👥 Total Users     : ${s.totalUsers}\n`;
    msg += `📥 Total Downloads : ${s.totalDownloads}\n\n`;

    msg += `🎵 TikTok    : ${s.tiktok}\n`;
    msg += `📸 Instagram : ${s.instagram}\n`;
    msg += `📘 Facebook  : ${s.facebook}\n`;
    msg += `${'─'.repeat(30)}\n\n`;

    msg += `👤 RECENT USERS (last 15)\n`;
    const userList = Object.values(s.users)
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .slice(0, 15);

    if (userList.length === 0) {
      msg += `  No users yet.\n`;
    } else {
      userList.forEach((u, i) => {
        const name = u.username ? `@${u.username}` : u.firstName || 'Unknown';
        msg += `  ${i + 1}. ${name} — ${u.downloads} DL\n`;
      });
    }

    if (s.totalUsers > 15) {
      msg += `  ... and ${s.totalUsers - 15} more\n`;
    }

    return msg;
  } catch (err) {
    return `🛠 Admin Panel\n\n❌ Error building panel: ${err.message}`;
  }
}

// ── Broadcast state ───────────────────────────────────────────────────────────
const broadcastState = new Map();

// ── Register handlers ─────────────────────────────────────────────────────────
function registerAdmin(bot) {

  // /admin command
  bot.command('admin', async (ctx) => {
    console.log(`[Admin] /admin from user ID: ${ctx.from?.id}, configured ADMIN_ID: ${ADMIN_ID}`);

    if (!ADMIN_ID) {
      return ctx.reply(
        '⚠️ ADMIN_ID is not configured.\n\n' +
        'Set the ADMIN_ID environment variable in Render to your Telegram numeric ID.\n' +
        'Get your ID from @userinfobot'
      );
    }

    if (!isAdmin(ctx)) {
      return ctx.reply(`⛔ Access denied.\n\nYour ID: ${ctx.from?.id}`);
    }

    try {
      const panel = buildPanelText();
      await ctx.reply(panel, ADMIN_KB());
    } catch (err) {
      console.error('[Admin] Error sending panel:', err);
      await ctx.reply(`❌ Admin panel error: ${err.message}`);
    }
  });

  // Refresh
  bot.action('admin_refresh', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    try {
      await ctx.answerCbQuery('✅ Refreshed!');
      const panel = buildPanelText();
      await ctx.editMessageText(panel, { reply_markup: ADMIN_KB().reply_markup });
    } catch (err) {
      console.error('[Admin] Refresh error:', err.message);
      await ctx.answerCbQuery('❌ Refresh failed');
    }
  });

  // Stats only
  bot.action('admin_stats', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    try {
      await ctx.answerCbQuery();
      const s = db.getStats();
      const text =
        `📊 Download Stats\n\n` +
        `📥 Total : ${s.totalDownloads}\n` +
        `🎵 TikTok : ${s.tiktok}\n` +
        `📸 Instagram : ${s.instagram}\n` +
        `📘 Facebook : ${s.facebook}`;
      await ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_back')]]));
    } catch (err) {
      await ctx.answerCbQuery('❌ Error');
    }
  });

  // Full user list
  bot.action('admin_users', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    try {
      await ctx.answerCbQuery();
      const s = db.getStats();
      const users = Object.values(s.users);
      let text = `👥 All Users (${users.length} total)\n${'─'.repeat(28)}\n`;
      users.slice(0, 50).forEach((u, i) => {
        const name = u.username ? `@${u.username}` : u.firstName || 'Unknown';
        text += `${i + 1}. ${name} — ${u.downloads} DL\n`;
      });
      if (users.length > 50) text += `\n... and ${users.length - 50} more`;
      await ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_back')]]));
    } catch (err) {
      await ctx.answerCbQuery('❌ Error');
    }
  });

  // Back to main panel
  bot.action('admin_back', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    try {
      await ctx.answerCbQuery();
      const panel = buildPanelText();
      await ctx.reply(panel, ADMIN_KB());
    } catch (_) {}
  });

  // Broadcast prompt
  bot.action('admin_broadcast', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⛔ Not authorised.');
    await ctx.answerCbQuery();
    broadcastState.set(String(ctx.from.id), true);
    await ctx.reply(
      '📣 Broadcast Mode\n\n' +
      'Send the message you want to broadcast to ALL users.\n' +
      'Send /cancel to cancel.'
    );
  });
}

// ── Broadcast execution (called from bot.js text handler) ─────────────────────
async function handleBroadcast(ctx, bot) {
  const uid = String(ctx.from?.id);
  if (!broadcastState.get(uid)) return false;

  const text = ctx.message?.text;

  // Allow cancel
  if (text === '/cancel') {
    broadcastState.delete(uid);
    await ctx.reply('❌ Broadcast cancelled.');
    return true;
  }

  if (!text) return false;
  broadcastState.delete(uid);

  const users = db.getAllUsers();
  let sent = 0, failed = 0;

  const statusMsg = await ctx.reply(`📣 Broadcasting to ${users.length} users…\nPlease wait.`);

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.id, `📢 Message from Admin:\n\n${text}`);
      sent++;
    } catch (_) {
      failed++;
    }
    // Throttle: ~28 msgs/sec (Telegram limit is 30/sec)
    await new Promise(r => setTimeout(r, 35));
  }

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `✅ Broadcast Complete!\n\n📤 Sent    : ${sent}\n❌ Failed  : ${failed}\n👥 Total   : ${users.length}`
    );
  } catch (_) {
    await ctx.reply(`✅ Done! Sent: ${sent} | Failed: ${failed}`);
  }

  return true;
}

module.exports = { registerAdmin, handleBroadcast, isAdmin };
