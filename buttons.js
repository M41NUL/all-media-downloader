/**
 * ============================================
 * All Media Downloader Bot - Buttons & Messages
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

const { Markup } = require('telegraf');
const { DEV, PROGRESS } = require('./config');

// ── MarkdownV2 escape ─────────────────────────────────────────────────────────

function escMd(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ══════════════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ══════════════════════════════════════════════════════════════════════════════

// ── Main Menu ────────────────────────────────────────────────────────────────
const MAIN_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('🎬 Auto Detect Mode', 'mode_auto'),
    Markup.button.callback('🎯 Manual Mode',      'mode_manual'),
  ],
  [
    Markup.button.callback('⚙️ Settings', 'settings'),
    Markup.button.callback('❓ Help',     'help'),
  ],
  [
    Markup.button.url('📢 Channel', DEV.channel),
    Markup.button.url('👥 Group',   DEV.group),
  ],
]);

// ── Auto Detect submenu ───────────────────────────────────────────────────────
const AUTO_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ ON',  'auto_on'),
    Markup.button.callback('🔴 OFF', 'auto_off'),
  ],
  [Markup.button.callback('🔙 Back', 'back_main')],
]);

// ── Auto Detect — waiting for link (ON state) ─────────────────────────────────
const AUTO_ON_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🔴 Disable', 'auto_off')],
  [Markup.button.callback('🔙 Back',    'back_main')],
]);

// ── Manual — platform selector ────────────────────────────────────────────────
const PLATFORM_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('🎵 TikTok',    'platform_tiktok'),
    Markup.button.callback('📸 Instagram', 'platform_instagram'),
    Markup.button.callback('📘 Facebook',  'platform_facebook'),
  ],
  [Markup.button.callback('🔙 Back', 'back_main')],
]);

// ── Manual — waiting for link (per platform) ─────────────────────────────────
const MANUAL_WAITING_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🔙 Back to Platforms', 'mode_manual')],
]);

// ── Final result action buttons ───────────────────────────────────────────────
const RESULT_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔄 New Video', 'result_new'),
    Markup.button.callback('🧹 Clear',     'result_clear'),
  ],
]);

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('👨‍💻 Developer Info', 'developer')],
  [
    Markup.button.url('📢 Channel', DEV.channel),
    Markup.button.url('👥 Group',   DEV.group),
  ],
  [Markup.button.callback('🔙 Back', 'back_main')],
]);

// ── Generic back to main ──────────────────────────────────────────────────────
const BACK_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Main Menu', 'back_main')],
]);

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGE TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

function welcomeText(firstName) {
  return (
`🎬 *All Media Downloader*

👋 Welcome, *${escMd(firstName)}*\\!

Download videos from:
• 🎵 *TikTok* — no watermark
• 📸 *Instagram* — Reels \\& Posts
• 📘 *Facebook* — Public videos

Select a mode to get started ⬇️`
  );
}

function autoDetectMenuText() {
  return (
`🎬 *Auto Detect Mode*

Turn ON to send any supported video link\\.
The bot will detect the platform automatically\\.`
  );
}

function autoOnText() {
  return (
`⚡ *Auto Detect Mode Enabled*

Please send your video link\\.
Supported: TikTok • Instagram • Facebook`
  );
}

function autoOffText() {
  return (
`⚠️ *Auto Detect Mode Disabled*

Link processing has been stopped\\.
Press *ON* to re\\-enable or go back to the main menu\\.`
  );
}

function manualModeText() {
  return `🎯 *Manual Mode* — Select a platform:`;
}

function manualSelectedText(platform) {
  const icons = { TikTok: '🎵', Instagram: '📸', Facebook: '📘' };
  const icon  = icons[platform] || '🎬';
  return (
`${icon} *You selected ${escMd(platform)}*

Please send your video link\\.`
  );
}

function helpText() {
  return (
`❓ *How to Use All Media Downloader*

*🎬 Auto Detect Mode*
1\\. Tap *Auto Detect Mode* → press *ON*
2\\. Send any supported video link
3\\. Bot auto\\-detects platform & downloads

*🎯 Manual Mode*
1\\. Tap *Manual Mode*
2\\. Select platform \\(TikTok / Instagram / Facebook\\)
3\\. Send the video link
4\\. Receive your video ✅

*📌 Supported Platforms*
• 🎵 TikTok — no watermark
• 📸 Instagram — Reels, Posts, IGTV
• 📘 Facebook — Public videos

*⚠️ Notes*
• Only public videos are supported
• Max file size: 50 MB via Telegram
• Video link must be valid & accessible`
  );
}

function developerText() {
  return (
`👨‍💻 *Developer Information*

🧑 *Name:* ${escMd(DEV.name)}
🏷️ *Owner:* ${escMd(DEV.owner)}
📱 *Telegram:* [${escMd(DEV.handle)}](${DEV.telegram})
💻 *GitHub:* [M41NUL](${DEV.github})
📞 *WhatsApp:* ${escMd(DEV.whatsapp)}
📧 *Email:* ${escMd(DEV.email1)}
▶️ *YouTube:* [codexm41nul](${DEV.youtube})

📢 *Channel:* [codexm41nul](${DEV.channel})
👥 *Group:* [codex\\_m41nul](${DEV.group})`
  );
}

// ── Progress bar builder ──────────────────────────────────────────────────────

/**
 * Build a progress bar string.
 * @param {number} percent      0–100
 * @param {string} [speed]      optional speed label e.g. "2.3 MB/s"
 * @param {'download'|'send'} type
 * @param {string} [sizeLabel]  optional "6.2 MB / 10 MB" style size line
 */
function progressBar(percent, speed, type = 'download', sizeLabel = null) {
  if (type === 'download') {
    return `⬇️ *Downloading Video\\.\\.\\.*\n_Please wait\\.\\.\\._`;
  }
  return `📤 *Sending Video\\.\\.\\.*\n_Please wait\\.\\.\\._`;
}

// ── Final result caption ──────────────────────────────────────────────────────

/**
 * Caption sent WITH the video.
 * Title is rendered as inline-code so it's one-tap copyable.
 *
 * Telegram allows max 1024 characters in a video caption. The title must
 * NEVER be cut — instead, if the full caption would exceed the limit,
 * the Bot/Dev branding lines are progressively shortened/dropped until
 * it fits, always keeping the title 100% intact.
 *
 * Only in the extreme case where the title ALONE (plus the basic info
 * block) still exceeds 1024 chars, the title is trimmed with "..." and
 * `truncated: true` is returned so the caller can send the full title
 * as a separate follow-up text message.
 *
 * @returns {{ caption: string, truncated: boolean, fullTitle: string|null }}
 */
function resultCaption(info) {
  const rawTitle = info.title || 'Unknown';
  const title    = escMd(rawTitle);
  const platform = escMd(info.platform || 'Unknown');
  const size     = escMd(info.size     || 'Unknown');
  const duration = escMd(info.duration || 'Unknown');

  const infoBlock =
`🌐 *Platform:* ${platform}
🎥 *Format:* MP4
⚖️ *Size:* ${size}
⏱️ *Duration:* ${duration}`;

  const buildTitleBlock = (t) => `📋 *Title:* \`${t}\``;

  // Tier 1: full branding (Bot + Dev links)
  const brandFull =
`🤖 *Bot:* [All Media Downloader](https://t.me/allmedia_downloaderx_bot)
👨‍💻 *Dev:* [MAINUL ISLAM](https://${DEV.telegram})`;

  // Tier 2: shortened branding (Dev only)
  const brandShort = `👨‍💻 *Dev:* [MAINUL ISLAM](https://${DEV.telegram})`;

  const CAPTION_LIMIT = 1024;
  const titleBlock = buildTitleBlock(title);

  let caption = `${titleBlock}\n\n${infoBlock}\n\n${brandFull}`;
  if (caption.length <= CAPTION_LIMIT) return { caption, truncated: false, fullTitle: null };

  caption = `${titleBlock}\n\n${infoBlock}\n\n${brandShort}`;
  if (caption.length <= CAPTION_LIMIT) return { caption, truncated: false, fullTitle: null };

  // Tier 3: no branding at all — title + info only (title still 100% intact)
  caption = `${titleBlock}\n\n${infoBlock}`;
  if (caption.length <= CAPTION_LIMIT) return { caption, truncated: false, fullTitle: null };

  // Tier 4 (rare): title alone pushes it over the limit — trim with "..."
  // and flag it so the full title can be sent as a follow-up message.
  const overflow    = caption.length - CAPTION_LIMIT + 3; // +3 for the "..." we add
  const trimmedTitle = title.slice(0, Math.max(0, title.length - overflow)) + '...';
  caption = `${buildTitleBlock(trimmedTitle)}\n\n${infoBlock}`;
  return { caption, truncated: true, fullTitle: rawTitle };
}

// ── Error message ─────────────────────────────────────────────────────────────

function errorText(message) {
  return (
`❌ *Download Failed*

${escMd(message)}

_This message will be deleted in 3 seconds\\.\\.\\._`
  );
}

// ── Send-failure message (video downloaded but could not be delivered) ───────

function sendFailedText() {
  return `❌ *Video could not be sent\\.* Please try again\\.`;
}

// ── Settings text ─────────────────────────────────────────────────────────────

function settingsText() {
  return (
`⚙️ *Settings*

Manage your bot preferences and info below\\.`
  );
}

// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // keyboards
  MAIN_MENU,
  AUTO_MENU,
  AUTO_ON_MENU,
  PLATFORM_MENU,
  MANUAL_WAITING_MENU,
  RESULT_MENU,
  SETTINGS_MENU,
  BACK_MENU,
  // text builders
  welcomeText,
  autoDetectMenuText,
  autoOnText,
  autoOffText,
  manualModeText,
  manualSelectedText,
  helpText,
  developerText,
  progressBar,
  resultCaption,
  errorText,
  sendFailedText,
  settingsText,
  // util
  escMd,
};
