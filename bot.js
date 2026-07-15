/**
 * ============================================
 * All Media Downloader Bot - Main
 * ============================================
 * Developer : Md. Mainul Islam
 * Owner     : CODEX-M41NUL
 * Telegram  : https://t.me/mdmainulislaminfo
 * GitHub    : https://github.com/M41NUL
 * WhatsApp  : +8801308850528
 * Channel   : https://t.me/codexm41nul
 * Group     : https://t.me/codex_m41nul
 * Email     : devmainulislam@gmail.com
 * YouTube   : https://youtube.com/@codexm41nul
 * License   : MIT License
 * ============================================
 */

'use strict';

const express      = require('express');
const path         = require('path');
const os           = require('os');
const https        = require('https');
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
  progressBar, resultCaption, errorText,
  escMd,
} = require('./buttons');
const { registerAdmin, handleBroadcast } = require('./admin');

// ── Validate env ──────────────────────────────────────────────────────────────

if (!config.BOT_TOKEN) {
  console.error('BOT_TOKEN is not set. Exiting.');
  process.exit(1);
}

// ── Bot instance ──────────────────────────────────────────────────────────────

// keepAlive + generous timeout agent — reduces "socket hang up" errors on
// slow/free-tier hosts when uploading larger video files to Telegram.
const telegramAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  timeout: 120000, // 120s socket timeout
});

const bot = new Telegraf(config.BOT_TOKEN, {
  telegram: { agent: telegramAgent },
  handlerTimeout: 180000, // allow slow download+send handlers up to 180s
});

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

/**
 * Animate a progress bar by editing the status message step by step.
 * steps: [[percent, speedLabel?], ...]
 */
async function animateProgress(ctx, chatId, msgId, steps, type = 'download') {
  const { STEP_INTERVAL_MS } = config.PROGRESS;
  for (const [pct, speed] of steps) {
    await safeEdit(ctx, chatId, msgId, progressBar(pct, speed, type), {
      parse_mode: 'MarkdownV2',
    });
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));
  }
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
  await ctx.answerCbQuery('Auto Detect Enabled');
  const sess        = getSession(ctx.from.id);
  sess.mode         = 'auto';
  sess.autoEnabled  = true;

  try {
    await ctx.editMessageText(autoOnText(), {
      parse_mode   : 'MarkdownV2',
      reply_markup : AUTO_ON_MENU.reply_markup,
    });
  } catch (_) {
    await ctx.replyWithMarkdownV2(autoOnText(), AUTO_ON_MENU);
  }
});

// AUTO OFF
bot.action('auto_off', async (ctx) => {
  await ctx.answerCbQuery('Auto Detect Disabled');
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

// New Video — reset link data, stay in same mode
bot.action('result_new', async (ctx) => {
  await ctx.answerCbQuery('Ready for new video');
  const sess = getSession(ctx.from.id);

  // Delete the video message (caption has the buttons)
  try { await ctx.deleteMessage(); } catch (_) {}

  if (sess.mode === 'auto') {
    // Re-show Auto ON prompt
    await ctx.replyWithMarkdownV2(autoOnText(), AUTO_ON_MENU);
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

// Delete — just remove the video message, no menu reset
bot.action('result_clear', async (ctx) => {
  await ctx.answerCbQuery('Deleted');
  try { await ctx.deleteMessage(); } catch (_) {}
});

// ══════════════════════════════════════════════════════════════════════════════
// TEXT HANDLER — link processing
// ══════════════════════════════════════════════════════════════════════════════

bot.on('text', async (ctx, next) => {

  const textRaw = ctx.message.text;

  if (textRaw.startsWith('/')) {
    // Let command handlers (e.g. /admin) run.
    return next();
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
      'Please select a mode first\\.',
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
      '*Unsupported link*\n\nPlease send a valid TikTok, Instagram, or Facebook URL\\.',
      BACK_MENU
    );
    setTimeout(() => safeDelete(ctx, chatId, errMsg.message_id), config.ERROR_AUTODELETE_MS);
    return;
  }

  // Delete user's link for clean chat
  await safeDelete(ctx, chatId, userMid);

  // ── Step 1: Checking link ─────────────────────────────────────────────────
  const statusMsg = await ctx.replyWithMarkdownV2('*Checking link\\.\\.\\.*');

  await new Promise(r => setTimeout(r, 600));
  await safeEdit(ctx, chatId, statusMsg.message_id,
    '*Extracting video information\\.\\.\\.*',
    { parse_mode: 'MarkdownV2' }
  );
  await new Promise(r => setTimeout(r, 700));

  await safeEdit(ctx, chatId, statusMsg.message_id,
    progressBar(0, '0 MB/s', 'download'),
    { parse_mode: 'MarkdownV2' }
  );

  const startedAt = Date.now();

  // Wrap download so we can distinguish it from animation in Promise.race
  const DOWNLOAD_DONE = Symbol('download_done');
  const downloadPromise = download(text, sess.platform || null)
    .then(result => ({ __tag: DOWNLOAD_DONE, result }));

  // Animate bar step by step, but abort early if download resolves/rejects
  const { STEP_INTERVAL_MS, DOWNLOAD_STEPS } = config.PROGRESS;
  let info;

  try {
    for (const [pct, speed] of DOWNLOAD_STEPS) {
      // Race: whichever comes first — next bar tick OR download finishing
      const winner = await Promise.race([
        new Promise(r => setTimeout(() => r(null), STEP_INTERVAL_MS)),
        downloadPromise,
      ]);

      if (winner && winner.__tag === DOWNLOAD_DONE) {
        // Download finished before this step — snap bar to 100% and break
        info = winner.result;
        await safeEdit(ctx, chatId, statusMsg.message_id,
          progressBar(100, 'done', 'download'),
          { parse_mode: 'MarkdownV2' }
        );
        break;
      }

      // Normal tick — update bar
      await safeEdit(ctx, chatId, statusMsg.message_id,
        progressBar(pct, speed, 'download'),
        { parse_mode: 'MarkdownV2' }
      );
    }

    if (!info) {
      const winner = await downloadPromise;
      info = winner.result;
      await safeEdit(ctx, chatId, statusMsg.message_id,
        progressBar(100, 'done', 'download'),
        { parse_mode: 'MarkdownV2' }
      );
    }

  } catch (err) {
    console.error(`[Download Error] ${platform} | ${text} | ${err.message}`);
    db.recordFailure(platform);
    await safeEdit(ctx, chatId, statusMsg.message_id,
      errorText(err.message),
      { parse_mode: 'MarkdownV2' }
    );
    setTimeout(() => safeDelete(ctx, chatId, statusMsg.message_id), config.ERROR_AUTODELETE_MS);
    return;
  }

  // ── Step 3: Send progress bar ─────────────────────────────────────────────
  const sendSteps = config.PROGRESS.SEND_STEPS.map(p => [p]);
  await safeEdit(ctx, chatId, statusMsg.message_id,
    progressBar(0, null, 'send'),
    { parse_mode: 'MarkdownV2' }
  );
  await animateProgress(ctx, chatId, statusMsg.message_id, sendSteps, 'send');

  // Record stat (with timing + size for the public dashboard)
  const elapsedMs = Date.now() - startedAt;
  let fileBytes = 0;
  try {
    fileBytes = require('fs').statSync(info.filePath).size;
  } catch (_) {}
  db.recordDownload(ctx.from.id, platform, { timeMs: elapsedMs, bytes: fileBytes });

  // Delete progress message
  await safeDelete(ctx, chatId, statusMsg.message_id);

  try {
    const { createReadStream } = require('fs');
    const MAX_SEND_ATTEMPTS = 3;
    let lastErr = null;

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
      try {
        await ctx.replyWithVideo(
          // re-create the stream each attempt — a stream can only be read once
          { source: createReadStream(info.filePath), filename: 'video.mp4' },
          {
            caption      : resultCaption(info),
            parse_mode   : 'MarkdownV2',
            reply_markup : RESULT_MENU.reply_markup,
          }
        );
        lastErr = null;
        break; // success
      } catch (sendErr) {
        lastErr = sendErr;
        const transient = /socket hang up|ETIMEDOUT|ECONNRESET|timed out/i.test(sendErr.message || '');
        console.error(`[Send Error] attempt ${attempt}/${MAX_SEND_ATTEMPTS} | ${sendErr.message}`);
        if (!transient || attempt === MAX_SEND_ATTEMPTS) break;
        // exponential backoff: 2s, 4s
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    if (lastErr) {
      await ctx.replyWithMarkdownV2(
        `${resultCaption(info)}\n\n_Video could not be sent\\._`,
        { reply_markup: RESULT_MENU.reply_markup }
      );
    }
  } finally {
    cleanupFile(info.filePath);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN
// Register admin command handlers BEFORE the generic text handler above would
// otherwise be fine too (Telegraf matches bot.command internally on 'text'
// updates), but we call next() from the text handler for '/' messages so this
// ordering is safe either way.
// ══════════════════════════════════════════════════════════════════════════════

registerAdmin(bot);

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════════════════════

bot.catch((err, ctx) => {
  console.error(`[Bot Error] Update ${ctx.update?.update_id}:`, err);
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPRESS + WEBHOOK + PUBLIC STATUS SITE
// ══════════════════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// Static status dashboard: public/index.html (+ any assets alongside it)
app.use(express.static(path.join(__dirname, 'public')));

// ── Public, read-only stats API ────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  try {
    const publicStats = db.getPublicStats();
    const uptimeSec   = process.uptime();

    const memMB = process.memoryUsage().rss / 1024 / 1024;

    // Approximate process CPU % over the node process lifetime.
    const cpus = os.cpus();
    let cpuPercent = null;
    if (cpus && cpus.length) {
      const usage = process.cpuUsage();
      const totalCpuMs = (usage.user + usage.system) / 1000;
      cpuPercent = uptimeSec > 0
        ? Math.min(100, (totalCpuMs / (uptimeSec * 1000)) * 100)
        : 0;
    }

    res.json({
      status        : 'operational',
      uptime        : uptimeSec,
      users         : publicStats.users,
      downloads     : publicStats.downloads,
      byPlatform    : publicStats.byPlatform,
      successRate   : publicStats.successRate,
      memoryMB      : memMB,
      cpuPercent,
      avgTimeSec    : publicStats.avgTimeSec,
      avgSpeedKbps  : publicStats.avgSpeedKbps,
      version       : config.VERSION,
      last7Days     : publicStats.last7Days,
      recentActivity: publicStats.recentActivity,
      dailyLimit    : null,
      restarts      : publicStats.restarts,
      lastDeploy    : publicStats.lastDeploy,
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

// ── Machine-readable endpoint list ─────────────────────────────────────────
app.get('/api/endpoints', (_req, res) => {
  res.json({
    baseUrl   : config.WEBHOOK_URL || null,
    endpoints : [
      {
        method      : 'GET',
        path        : '/api/stats',
        description : 'Live stats: users, downloads, success rate, memory, CPU, avg time & speed, last 7 days.',
      },
      {
        method      : 'GET',
        path        : '/api/endpoints',
        description : 'This list.',
      },
    ],
    note: 'There is no public media-download REST endpoint. Downloading only works through the Telegram bot.',
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
    console.error('WEBHOOK_URL is not set. Exiting.');
    process.exit(1);
  }

  const webhookUrl = `${webhookBase}${WEBHOOK_PATH}`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`Webhook set: ${webhookUrl}`);

  db.recordRestart();

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`All Media Downloader is live.`);
    console.log(`Developer: Md. Mainul Islam (@mdmainulislaminfo)`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
