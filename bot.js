/**
 * ============================================
 * All Media Downloader Bot - Main
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

const express       = require('express');
const { Telegraf }  = require('telegraf');

const config        = require('./config');
const db            = require('./database');
const { download, detectPlatform } = require('./downloader');
const {
  MAIN_MENU, PLATFORM_MENU, BACK_MENU,
  welcomeText, helpText, developerText, resultCaption,
  escMd,
}                   = require('./buttons');
const { registerAdmin, handleBroadcast } = require('./admin');

// ── Validate env ──────────────────────────────────────────────────────────────

if (!config.BOT_TOKEN) {
  console.error('❌  BOT_TOKEN is not set. Exiting.');
  process.exit(1);
}

// ── Bot instance ──────────────────────────────────────────────────────────────

const bot = new Telegraf(config.BOT_TOKEN);

// ── Per-user session (in-memory, lightweight) ─────────────────────────────────
// mode: null | 'auto' | 'manual'
// platform: null | 'tiktok' | 'instagram' | 'facebook'
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) sessions.set(userId, { mode: null, platform: null });
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.set(userId, { mode: null, platform: null });
}

// ── Helper: safe delete ───────────────────────────────────────────────────────

async function safeDelete(ctx, chatId, messageId) {
  try { await ctx.telegram.deleteMessage(chatId, messageId); } catch (_) {}
}

// ── Helper: safe edit ─────────────────────────────────────────────────────────

async function safeEdit(ctx, chatId, msgId, text, extra = {}) {
  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, text, extra);
    return true;
  } catch (_) {
    return false;
  }
}

// ── /start ────────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  db.upsertUser(ctx.from);
  clearSession(ctx.from.id);

  await ctx.replyWithMarkdownV2(
    welcomeText(ctx.from.first_name || 'there'),
    MAIN_MENU
  );
});

// ── Back to main menu ─────────────────────────────────────────────────────────

bot.action('back_main', async (ctx) => {
  await ctx.answerCbQuery();
  clearSession(ctx.from.id);
  try {
    await ctx.editMessageText(
      welcomeText(ctx.from.first_name || 'there'),
      { parse_mode: 'MarkdownV2', reply_markup: MAIN_MENU.reply_markup }
    );
  } catch (_) {
    await ctx.replyWithMarkdownV2(
      welcomeText(ctx.from.first_name || 'there'),
      MAIN_MENU
    );
  }
});

// ── Help ──────────────────────────────────────────────────────────────────────

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      helpText(),
      { parse_mode: 'MarkdownV2', reply_markup: BACK_MENU.reply_markup }
    );
  } catch (_) {
    await ctx.replyWithMarkdownV2(helpText(), BACK_MENU);
  }
});

// ── Developer ─────────────────────────────────────────────────────────────────

bot.action('developer', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      developerText(),
      { parse_mode: 'MarkdownV2', reply_markup: BACK_MENU.reply_markup }
    );
  } catch (_) {
    await ctx.replyWithMarkdownV2(developerText(), BACK_MENU);
  }
});

// ── Auto Detect mode ──────────────────────────────────────────────────────────

bot.action('mode_auto', async (ctx) => {
  await ctx.answerCbQuery();
  const sess    = getSession(ctx.from.id);
  sess.mode     = 'auto';
  sess.platform = null;

  try {
    await ctx.editMessageText(
      '✅ *Auto Detect Mode Enabled*\n\nPlease send your video link\\.',
      { parse_mode: 'MarkdownV2' }
    );
  } catch (_) {
    await ctx.replyWithMarkdownV2(
      '✅ *Auto Detect Mode Enabled*\n\nPlease send your video link\\.'
    );
  }
});

// ── Manual mode ───────────────────────────────────────────────────────────────

bot.action('mode_manual', async (ctx) => {
  await ctx.answerCbQuery();
  const sess = getSession(ctx.from.id);
  sess.mode  = 'manual';

  try {
    await ctx.editMessageText(
      '🎛️ *Manual Mode* — Select a platform:',
      { parse_mode: 'MarkdownV2', reply_markup: PLATFORM_MENU.reply_markup }
    );
  } catch (_) {
    await ctx.replyWithMarkdownV2(
      '🎛️ *Manual Mode* — Select a platform:',
      PLATFORM_MENU
    );
  }
});

// ── Platform selection ────────────────────────────────────────────────────────

['tiktok', 'instagram', 'facebook'].forEach((p) => {
  bot.action(`platform_${p}`, async (ctx) => {
    await ctx.answerCbQuery();
    const sess    = getSession(ctx.from.id);
    sess.platform = p;

    const label = p.charAt(0).toUpperCase() + p.slice(1);
    try {
      await ctx.editMessageText(
        `✅ You selected *${escMd(label)}*\\.\n\nPlease send your video link\\.`,
        { parse_mode: 'MarkdownV2' }
      );
    } catch (_) {
      await ctx.replyWithMarkdownV2(
        `✅ You selected *${escMd(label)}*\\.\n\nPlease send your video link\\.`
      );
    }
  });
});

// ── Message handler (link processing) ────────────────────────────────────────

bot.on('text', async (ctx) => {
  db.upsertUser(ctx.from);

  // Let admin module handle broadcast if applicable
  const consumed = await handleBroadcast(ctx, bot);
  if (consumed) return;

  const sess    = getSession(ctx.from.id);
  const text    = ctx.message.text.trim();
  const chatId  = ctx.chat.id;
  const userMid = ctx.message.message_id;

  // If no active mode, show the main menu
  if (!sess.mode) {
    await safeDelete(ctx, chatId, userMid);
    return ctx.replyWithMarkdownV2(
      welcomeText(ctx.from.first_name || 'there'),
      MAIN_MENU
    );
  }

  // Determine platform
  const platform = sess.platform || detectPlatform(text);

  if (!platform) {
    const errMsg = await ctx.reply(
      '⚠️ Unsupported link. Please send a valid TikTok, Instagram, or Facebook URL.'
    );
    await safeDelete(ctx, chatId, userMid);
    setTimeout(() => safeDelete(ctx, chatId, errMsg.message_id), 5000);
    return;
  }

  // Delete user's link message for clean chat
  await safeDelete(ctx, chatId, userMid);

  // Show live "Downloading…" indicator
  const statusMsg = await ctx.reply('⏳ Downloading video…');

  try {
    // Real download — no fake delay
    const info = await download(text, sess.platform || null);

    // Update status message to "Sending…"
    await safeEdit(ctx, chatId, statusMsg.message_id, '📤 Sending video…');

    // Record stat
    db.recordDownload(ctx.from.id, platform);

    // Build caption
    const caption = resultCaption(info);

    // Delete the processing message
    await safeDelete(ctx, chatId, statusMsg.message_id);

    // Send the final video
    await ctx.replyWithVideo(
      { url: info.url },
      { caption, parse_mode: 'MarkdownV2' }
    );

  } catch (err) {
    console.error(`[Download Error] ${platform} | ${text} | ${err.message}`);

    await safeEdit(
      ctx, chatId, statusMsg.message_id,
      `❌ *Download Failed*\n\n${escMd(err.message)}`,
      { parse_mode: 'MarkdownV2', reply_markup: BACK_MENU.reply_markup }
    );
  }
});

// ── Register admin commands ───────────────────────────────────────────────────

registerAdmin(bot);

// ── Global error handler ──────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  console.error(`[Bot Error] Update ${ctx.update?.update_id}:`, err);
});

// ── Express + Webhook setup ───────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Health-check endpoint (Render pings this to keep the service alive)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', bot: 'All Media Downloader', dev: 'Md. Mainul Islam' });
});

// Telegram webhook path
const WEBHOOK_PATH = `/webhook/${config.BOT_TOKEN}`;

app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const port        = config.PORT;
  const webhookBase = config.WEBHOOK_URL.replace(/\/$/, '');

  if (!webhookBase) {
    console.error('❌  WEBHOOK_URL is not set. Exiting.');
    process.exit(1);
  }

  const webhookUrl = `${webhookBase}${WEBHOOK_PATH}`;

  // Register webhook with Telegram
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`✅  Webhook set: ${webhookUrl}`);

  app.listen(port, () => {
    console.log(`🚀  Server running on port ${port}`);
    console.log(`🤖  All Media Downloader is live!`);
    console.log(`👨‍💻  Developer: Md. Mainul Islam (@M41NUL)`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
