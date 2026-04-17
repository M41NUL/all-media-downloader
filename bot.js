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

const express      = require('express');
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
  await ctx.answerCbQuery('⚡ Auto Detect Enabled!');
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
    progressBar(0, '0 MB/s', 'download'),
    { parse_mode: 'MarkdownV2' }
  );

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
          progressBar(100, '✓', 'download'),
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
        progressBar(100, '✓', 'download'),
        { parse_mode: 'MarkdownV2' }
      );
    }

  } catch (err) {
    // Download failed — show error immediately
    console.error(`[Download Error] ${platform} | ${text} | ${err.message}`);
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

  // Record stat
  db.recordDownload(ctx.from.id, platform);

  // Delete progress message
  await safeDelete(ctx, chatId, statusMsg.message_id);


  try {
    const { createReadStream } = require('fs');
    await ctx.replyWithVideo(
      { source: createReadStream(info.filePath), filename: 'video.mp4' },
      {
        caption      : resultCaption(info),
        parse_mode   : 'MarkdownV2',
        reply_markup : RESULT_MENU.reply_markup,
      }
    );
  } catch (sendErr) {
    console.error(`[Send Error] ${sendErr.message}`);
    await ctx.replyWithMarkdownV2(
      `${resultCaption(info)}\n\n⚠️ _Video could not be sent\\._`,
      { reply_markup: RESULT_MENU.reply_markup }
    );
  } finally {
    
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

app.get('/', (_req, res) => {
  const uptime    = process.uptime();
  const hours     = Math.floor(uptime / 3600);
  const minutes   = Math.floor((uptime % 3600) / 60);
  const seconds   = Math.floor(uptime % 60);
  const uptimeStr = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>All Media Downloader Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      background: #0a0a0f;
      color: #e2e8f0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    body::before, body::after {
      content: '';
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      animation: float 8s ease-in-out infinite;
      pointer-events: none;
    }
    body::before {
      width: 400px; height: 400px;
      background: #6366f1;
      top: -100px; left: -100px;
    }
    body::after {
      width: 350px; height: 350px;
      background: #06b6d4;
      bottom: -100px; right: -100px;
      animation-delay: -4s;
    }
    @keyframes float {
      0%, 100% { transform: translate(0,0) scale(1); }
      50%       { transform: translate(30px,30px) scale(1.05); }
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      position: relative;
      z-index: 1;
    }
    .icon { font-size: 56px; margin-bottom: 16px; display: block; animation: pulse 3s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
    h1 { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
    .tagline { font-size: 13px; color: #64748b; margin-bottom: 28px; }
    .status-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(16,185,129,0.12);
      border: 1px solid rgba(16,185,129,0.25);
      color: #10b981; padding: 6px 16px; border-radius: 999px;
      font-size: 13px; font-weight: 600; margin-bottom: 28px;
    }
    .dot { width:7px; height:7px; background:#10b981; border-radius:50%; animation: blink 1.5s ease-in-out infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 28px; }
    .stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 8px; }
    .stat-value { font-size: 18px; font-weight: 700; color: #818cf8; margin-bottom: 3px; }
    .stat-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .platforms { display: flex; justify-content: center; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
    .platform { padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid; }
    .tiktok    { background: rgba(0,0,0,0.4);       border-color: rgba(255,255,255,0.15); color: #e2e8f0; }
    .instagram { background: rgba(214,41,118,0.12);  border-color: rgba(214,41,118,0.3);  color: #f472b6; }
    .facebook  { background: rgba(24,119,242,0.12);  border-color: rgba(24,119,242,0.3);  color: #60a5fa; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 0 0 24px; }
    .dev-info { display: flex; align-items: center; justify-content: center; gap: 12px; }
    .avatar { width:40px; height:40px; border-radius:50%; background: linear-gradient(135deg,#6366f1,#06b6d4); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    .dev-text { text-align: left; }
    .dev-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
    .dev-links { display: flex; gap: 8px; margin-top: 4px; }
    .dev-links a { font-size: 12px; color: #64748b; text-decoration: none; transition: color 0.2s; }
    .dev-links a:hover { color: #818cf8; }
    .dev-links span { color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">🎬</span>
    <h1>All Media Downloader</h1>
    <p class="tagline">Telegram Bot · Video Downloader</p>
    <div class="status-badge"><div class="dot"></div>System Online</div>
    <div class="stats">
      <div class="stat"><div class="stat-value">3</div><div class="stat-label">Platforms</div></div>
      <div class="stat"><div class="stat-value">${uptimeStr}</div><div class="stat-label">Uptime</div></div>
      <div class="stat"><div class="stat-value">v2.0.0</div><div class="stat-label">Version</div></div>
    </div>
    <div class="platforms">
      <span class="platform tiktok">⚫ TikTok</span>
      <span class="platform instagram">📸 Instagram</span>
      <span class="platform facebook">📘 Facebook</span>
    </div>
    <hr class="divider"/>
    <div class="dev-info">
      <div class="avatar">👨‍💻</div>
      <div class="dev-text">
        <div class="dev-name">Md. Mainul Islam</div>
        <div class="dev-links">
          <a href="https://t.me/mdmainulislaminfo" target="_blank">Telegram</a>
          <span>·</span>
          <a href="https://github.com/M41NUL" target="_blank">GitHub</a>
          <span>·</span>
          <a href="https://t.me/mainul_x_official" target="_blank">Channel</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
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
    console.log(`🚀  Server running on port ${port}`);
    console.log(`🤖  All Media Downloader is live!`);
    console.log(`👨‍💻  Developer: Md. Mainul Islam (@mdmainulislaminfo)`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
