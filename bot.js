/**
 * ============================================
 * All Media Downloader Bot - Main
 * ============================================
 * Developer : Md. Mainul Islam
 * Owner     : CODEX-M41NUL
 * Telegram  : t.me/mdmainulislaminfo
 * GitHub    : https://github.com/M41NUL
 * WhatsApp  : +8801308850528
 * Channel   : https://t.me/codexm41nul
 * Group     : https://t.me/codex_m41nul
 * Email     : devmainulislam@gmail.com
 * YouTube   : https://youtube.com/@codexm41nul
 * ============================================
 */

'use strict';

const express      = require('express');
const path         = require('path');
const os           = require('os');
const { Telegraf } = require('telegraf');

const config   = require('./config');
const db       = require('./database');
const { download, detectPlatform, cleanupFile } = require('./downloader');
const {
  MAIN_MENU, AUTO_MENU, AUTO_ON_MENU,
  PLATFORM_MENU, MANUAL_WAITING_MENU,
  RESULT_MENU, SETTINGS_MENU, BACK_MENU,
  welcomeText, autoDetectMenuText, autoOnText, autoOffText,
  manualModeText, manualSelectedText,
  helpText, developerText, settingsText,
  progressBar, resultCaption, errorText, sendFailedText,
  escMd,
} = require('./buttons');
const { registerAdmin, handleBroadcast } = require('./admin');

// ── Validate env ──────────────────────────────────────────────────────────────

if (!config.BOT_TOKEN) {
  console.error('❌  BOT_TOKEN is not set. Exiting.');
  process.exit(1);
}

// ── Bot instance ──────────────────────────────────────────────────────────────

const bot = new Telegraf(config.BOT_TOKEN);

// ══════════════════════════════════════════════════════════════════════════════
// SESSION
// shape: { mode, platform, autoEnabled, mainMsgId }
// mode        : null | 'auto' | 'manual'
// platform    : null | 'tiktok' | 'instagram' | 'facebook'
// autoEnabled : boolean  (ON/OFF toggle inside auto mode)
// mainMsgId   : message_id of the persistent main-menu message
// ══════════════════════════════════════════════════════════════════════════════

const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { mode: null, platform: null, autoEnabled: false, mainMsgId: null });
  }
  return sessions.get(userId);
}

function clearSession(userId) {
  const s = getSession(userId);
  s.mode        = null;
  s.platform    = null;
  s.autoEnabled = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

async function safeDelete(ctx, chatId, messageId) {
  if (!messageId) return;
  try { await ctx.telegram.deleteMessage(chatId, messageId); } catch (_) {}
}

async function safeEdit(ctx, chatId, msgId, text, extra = {}) {
  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, text, extra);
    return true;
  } catch (_) { return false; }
}

// ══════════════════════════════════════════════════════════════════════════════
// /start
// ══════════════════════════════════════════════════════════════════════════════

bot.start(async (ctx) => {
  db.upsertUser(ctx.from);
  clearSession(ctx.from.id);
  const sess = getSession(ctx.from.id);

  const msg = await ctx.replyWithMarkdownV2(
    welcomeText(ctx.from.first_name || 'there'),
    MAIN_MENU
  );
  sess.mainMsgId = msg.message_id;
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN MENU — back
// ══════════════════════════════════════════════════════════════════════════════

bot.action('back_main', async (ctx) => {
  await ctx.answerCbQuery();
  clearSession(ctx.from.id);
  const sess = getSession(ctx.from.id);

  try {
    await ctx.editMessageText(
      welcomeText(ctx.from.first_name || 'there'),
      { parse_mode: 'MarkdownV2', reply_markup: MAIN_MENU.reply_markup }
    );
    sess.mainMsgId = ctx.callbackQuery.message.message_id;
  } catch (_) {
    const msg = await ctx.replyWithMarkdownV2(
      welcomeText(ctx.from.first_name || 'there'),
      MAIN_MENU
    );
    sess.mainMsgId = msg.message_id;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

bot.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(settingsText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : SETTINGS_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(settingsText(), SETTINGS_MENU);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// HELP
// ══════════════════════════════════════════════════════════════════════════════

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(helpText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : BACK_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(helpText(), BACK_MENU);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEVELOPER
// ══════════════════════════════════════════════════════════════════════════════

bot.action('developer', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(developerText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : BACK_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(developerText(), BACK_MENU);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTO DETECT MODE
// ══════════════════════════════════════════════════════════════════════════════

// Open Auto Detect submenu
bot.action('mode_auto', async (ctx) => {
  await ctx.answerCbQuery();
  const sess    = getSession(ctx.from.id);
  sess.mode     = 'auto';
  sess.platform = null;

  try {
    await ctx.editMessageText(autoDetectMenuText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : AUTO_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(autoDetectMenuText(), AUTO_MENU);
  }
});

// AUTO ON
bot.action('auto_on', async (ctx) => {
  await ctx.answerCbQuery('⚡ Auto Detect Enabled!');
  const sess        = getSession(ctx.from.id);
  sess.mode         = 'auto';
  sess.autoEnabled  = true;

  try {
    await ctx.editMessageText(autoOnText(), {
      parse_mode   : 'MarkdownV2',
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(autoOnText());
  }
});

// AUTO OFF
bot.action('auto_off', async (ctx) => {
  await ctx.answerCbQuery('🔴 Auto Detect Disabled');
  const sess        = getSession(ctx.from.id);
  sess.autoEnabled  = false;

  try {
    await ctx.editMessageText(autoOffText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : AUTO_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(autoOffText(), AUTO_MENU);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MANUAL MODE
// ══════════════════════════════════════════════════════════════════════════════

bot.action('mode_manual', async (ctx) => {
  await ctx.answerCbQuery();
  const sess     = getSession(ctx.from.id);
  sess.mode      = 'manual';
  sess.platform  = null;

  try {
    await ctx.editMessageText(manualModeText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : PLATFORM_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(manualModeText(), PLATFORM_MENU);
  }
});

// Platform buttons
['tiktok', 'instagram', 'facebook'].forEach((p) => {
  bot.action(`platform_${p}`, async (ctx) => {
    await ctx.answerCbQuery();
    const sess    = getSession(ctx.from.id);
    sess.platform = p;

    const label = p.charAt(0).toUpperCase() + p.slice(1);
    try {
      await ctx.editMessageText(manualSelectedText(label), {
        parse_mode   : 'MarkdownV2',
        reply_markup : MANUAL_WAITING_MENU.reply_markup,
      });
    } catch (_) {
      await ctx.replyWithMarkdownV2(manualSelectedText(label), MANUAL_WAITING_MENU);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RESULT ACTION BUTTONS
// ══════════════════════════════════════════════════════════════════════════════

// 🔄 New Video — reset link data, stay in same mode
bot.action('result_new', async (ctx) => {
  await ctx.answerCbQuery('🔄 Ready for new video!');
  const sess = getSession(ctx.from.id);

  // Delete the video message (caption has the buttons)
  try { await ctx.deleteMessage(); } catch (_) {}

  if (sess.mode === 'auto') {
    // Re-show Auto ON prompt
    await ctx.replyWithMarkdownV2(autoOnText());
  } else if (sess.mode === 'manual' && sess.platform) {
    const label = sess.platform.charAt(0).toUpperCase() + sess.platform.slice(1);
    await ctx.replyWithMarkdownV2(manualSelectedText(label), MANUAL_WAITING_MENU);
  } else {
    await ctx.replyWithMarkdownV2(
      welcomeText(ctx.from.first_name || 'there'),
      MAIN_MENU
    );
  }
});


bot.action('result_clear', async (ctx) => {
  await ctx.answerCbQuery('🧹 Cleared!');
  const sess = getSession(ctx.from.id);
  const mode = sess.mode;

  clearSession(ctx.from.id);

  // Delete the video/result message
  try { await ctx.deleteMessage(); } catch (_) {}

  if (mode === 'auto') {
    // Reload auto detect menu
    sess.mode = 'auto';
    await ctx.replyWithMarkdownV2(autoDetectMenuText(), AUTO_MENU);
  } else {
    await ctx.replyWithMarkdownV2(
      welcomeText(ctx.from.first_name || 'there'),
      MAIN_MENU
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEXT HANDLER — link processing
// ══════════════════════════════════════════════════════════════════════════════

bot.on('text', async (ctx) => {

  const textRaw = ctx.message.text;

  
  if (textRaw.startsWith('/')) {
    if (textRaw === '/admin' || textRaw === '/start') return;
    return;
  }

  db.upsertUser(ctx.from);

  // Admin broadcast check
  const consumed = await handleBroadcast(ctx, bot);
  if (consumed) return;

  const sess    = getSession(ctx.from.id);
  const text    = textRaw.trim();
  const chatId  = ctx.chat.id;
  const userMid = ctx.message.message_id;

  // Guard: no active mode OR auto mode is OFF
  if (!sess.mode || (sess.mode === 'auto' && !sess.autoEnabled)) {
    await safeDelete(ctx, chatId, userMid);

    const nudge = await ctx.replyWithMarkdownV2(
      '⚠️ Please select a mode first\\.',
      MAIN_MENU
    );

    setTimeout(() => safeDelete(ctx, chatId, nudge.message_id), 4000);
    return;
  }

  // Determine platform
  const platform = sess.platform || detectPlatform(text);

  if (!platform) {
    await safeDelete(ctx, chatId, userMid);
    const errMsg = await ctx.replyWithMarkdownV2(
      '⚠️ *Unsupported link*\n\nPlease send a valid TikTok, Instagram, or Facebook URL\\.',
      BACK_MENU
    );
    setTimeout(() => safeDelete(ctx, chatId, errMsg.message_id), config.ERROR_AUTODELETE_MS);
    return;
  }

  // Delete user's link for clean chat
  await safeDelete(ctx, chatId, userMid);

  // ── Step 1: Checking link ─────────────────────────────────────────────────
  const statusMsg = await ctx.replyWithMarkdownV2('🔄 *Checking link\\.\\.\\.*');

  await new Promise(r => setTimeout(r, 600));
  await safeEdit(ctx, chatId, statusMsg.message_id,
    '📡 *Extracting video information\\.\\.\\.*',
    { parse_mode: 'MarkdownV2' }
  );
  await new Promise(r => setTimeout(r, 700));


  await safeEdit(ctx, chatId, statusMsg.message_id,
    progressBar(0, null, 'download'),
    { parse_mode: 'MarkdownV2' }
  );

  // ── Download the video ──────────────────────────────────────────────────
  let info;
  const downloadStartedAt = Date.now();

  try {
    info = await download(text, sess.platform || null, null);
  } catch (err) {
    // Download failed — show error immediately
    console.error(`[Download Error] ${platform} | ${text} | ${err.message}`);
    db.recordFailure(sess.platform || null);
    await safeEdit(ctx, chatId, statusMsg.message_id,
      errorText(err.message),
      { parse_mode: 'MarkdownV2' }
    );
    setTimeout(() => safeDelete(ctx, chatId, statusMsg.message_id), config.ERROR_AUTODELETE_MS);
    return;
  }

  // ── Step 3: Sending video ────────────────────────────────────────────────
  await safeEdit(ctx, chatId, statusMsg.message_id,
    progressBar(0, null, 'send'),
    { parse_mode: 'MarkdownV2' }
  );

  // Record stat (with how long the download took + file size, for avg-time/avg-speed stats)
  const downloadDurationMs = Date.now() - downloadStartedAt;
  const { existsSync: _exists, statSync: _stat } = require('fs');
  let downloadedBytes = null;
  try {
    if (_exists(info.filePath)) downloadedBytes = _stat(info.filePath).size;
  } catch (_) { /* ignore — speed just won't be recorded this time */ }
  db.recordDownload(ctx.from.id, platform, downloadDurationMs, downloadedBytes);

  try {
    const { existsSync, statSync } = require('fs');

    if (!existsSync(info.filePath)) {
      throw new Error('Downloaded file is missing on disk.');
    }

    const totalBytes = statSync(info.filePath).size;
    if (totalBytes <= 0) {
      throw new Error('Downloaded file is empty.');
    }

    // Send directly from the file path — Telegraf/Telegram handles the
    // upload internally. Streaming through an extra PassThrough offered
    // no benefit and could silently stall on slow connections, which is
    // what caused "Video could not be sent" errors.
    const { caption, truncated, fullTitle } = resultCaption(info);

    await ctx.replyWithVideo(
      { source: info.filePath, filename: 'video.mp4' },
      {
        caption,
        parse_mode   : 'MarkdownV2',
        reply_markup : RESULT_MENU.reply_markup,
      }
    );

    // Rare case: title alone exceeded Telegram's 1024-char caption limit
    // and had to be trimmed — send the untouched full title separately.
    if (truncated && fullTitle) {
      await ctx.replyWithMarkdownV2(
        `📋 *Full Title:*\n\`${escMd(fullTitle)}\``
      );
    }
  } catch (sendErr) {
    console.error(`[Send Error] ${sendErr.message}`);
    db.recordFailure(sess.platform || null);
    await ctx.replyWithMarkdownV2(
      sendFailedText(),
      { reply_markup: RESULT_MENU.reply_markup }
    );
  } finally {
    await safeDelete(ctx, chatId, statusMsg.message_id);
    cleanupFile(info.filePath);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════════════════

registerAdmin(bot);

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════════════════════

bot.catch((err, ctx) => {
  console.error(`[Bot Error] Update ${ctx.update?.update_id}:`, err);
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPRESS + WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Allow other developers to call our public, read-only API endpoints
// directly from their own websites/apps (browser fetch, etc).
app.use(['/api/stats', '/api/endpoints'], (_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

// ── CPU usage (%) ────────────────────────────────────────────────────────────
// Node has no built-in "instant CPU %", so we sample process.cpuUsage() over a
// short window each time it's requested. This reflects actual load caused by
// this process, normalized against available cores — good enough for a status
// gauge without adding a dependency.
let lastCpu = { time: Date.now(), usage: process.cpuUsage() };

function getCpuPercent() {
  const now       = Date.now();
  const usage     = process.cpuUsage(lastCpu.usage); // delta since last sample
  const elapsedMs = now - lastCpu.time;
  lastCpu = { time: now, usage: process.cpuUsage() };

  if (elapsedMs <= 0) return 0;
  const usedMs   = (usage.user + usage.system) / 1000;
  const cores    = os.cpus().length || 1;
  const percent  = (usedMs / (elapsedMs * cores)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent * 10) / 10));
}

app.get('/api/stats', (_req, res) => {
  const dash   = db.getDashboardStats();
  const memMB  = process.memoryUsage().rss / 1024 / 1024;

  res.json({
    status        : dash.status,
    uptime        : process.uptime(),
    users         : dash.totalUsers,
    downloads     : dash.totalDownloads,
    byPlatform    : dash.byPlatform,
    successRate   : dash.successRate,
    memoryMB      : memMB,
    cpuPercent    : getCpuPercent(),
    avgTimeSec    : dash.avgTimeSec,
    avgSpeedKbps  : dash.avgSpeedKbps,
    version       : 'v2.1.0',
    last7Days     : dash.last7Days,
    recentActivity: dash.recentActivity,
    dailyLimit    : null,
    restarts      : dash.restarts,
    lastDeploy    : dash.lastDeploy,
  });
});

// ── Public API documentation (machine-readable) ─────────────────────────────
// Lets other developers discover what this deployment exposes without
// reading source code. Mirrors what's shown on the /public dashboard page.
app.get('/api/endpoints', (_req, res) => {
  const base = config.WEBHOOK_URL ? config.WEBHOOK_URL.replace(/\/$/, '') : '';
  res.json({
    baseUrl: base || 'https://all-media-downloader-4o3l.onrender.com',
    endpoints: [
      {
        method     : 'GET',
        path       : '/api/stats',
        description: 'Public, read-only bot/server statistics — uptime, users, downloads, success rate, memory, CPU, avg download time & speed, last 7 days activity.',
        auth       : 'none',
        response   : {
          status: 'string', uptime: 'number (seconds)', users: 'number',
          downloads: 'number', byPlatform: '{ tiktok, instagram, facebook }',
          successRate: 'number|null (percent)', memoryMB: 'number',
          cpuPercent: 'number (percent, 0-100)', avgTimeSec: 'number|null',
          avgSpeedKbps: 'number|null', version: 'string',
          last7Days: '[{ label, count, avgTimeSec, successRate, percentOfWeek }]',
          recentActivity: '[{ platform, time }]', dailyLimit: 'number|null',
          restarts: 'number', lastDeploy: 'string|null (ISO date)',
        },
      },
      {
        method     : 'GET',
        path       : '/api/endpoints',
        description: 'This documentation endpoint.',
        auth       : 'none',
      },
      {
        method     : 'POST',
        path       : `/webhook/:BOT_TOKEN`,
        description: 'Telegram webhook — receives updates from Telegram only. Not usable directly by third parties (requires the bot\'s private token as the path segment, which Telegram alone is configured to call).',
        auth       : 'Telegram-only (token is part of the URL, not shared)',
      },
    ],
    notes: [
      'There is currently no public media-download REST endpoint — downloads only happen through the Telegram bot itself.',
      'All endpoints above are read-only and CORS-open; no API key required for /api/stats or /api/endpoints.',
    ],
  });
});

const WEBHOOK_PATH = `/webhook/${config.BOT_TOKEN}`;

app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  const port        = config.PORT;
  const webhookBase = config.WEBHOOK_URL.replace(/\/$/, '');

  if (!webhookBase) {
    console.error('❌  WEBHOOK_URL is not set. Exiting.');
    process.exit(1);
  }

  const webhookUrl = `${webhookBase}${WEBHOOK_PATH}`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`✅  Webhook set: ${webhookUrl}`);

  app.listen(port, () => {
    db.recordRestart();
    console.log(`🚀  Server running on port ${port}`);
    console.log(`🤖  All Media Downloader is live!`);
    console.log(`👨‍💻  Developer: Md. Mainul Islam (@mdmainulislaminfo)`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
