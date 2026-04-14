/**
 * ============================================
 * All Media Downloader Bot - Buttons & Messages
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
const { DEV }    = require('./config');

// ── Main menu ────────────────────────────────────────────────────────────────

const MAIN_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔍 Auto Detect', 'mode_auto'),
    Markup.button.callback('🎛️ Manual Mode', 'mode_manual'),
  ],
  [
    Markup.button.callback('ℹ️ Help',          'help'),
    Markup.button.callback('👨‍💻 Developer',     'developer'),
  ],
  [
    Markup.button.url('📢 Join Channel', DEV.channel),
    Markup.button.url('👥 Join Group',   DEV.group),
  ],
]);

// ── Platform selector (manual mode) ─────────────────────────────────────────

const PLATFORM_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('TikTok',    'platform_tiktok'),
    Markup.button.callback('Instagram', 'platform_instagram'),
    Markup.button.callback('Facebook',  'platform_facebook'),
  ],
  [Markup.button.callback('🔙 Back', 'back_main')],
]);

// ── Back to main ─────────────────────────────────────────────────────────────

const BACK_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Main Menu', 'back_main')],
]);

// ── Message templates ────────────────────────────────────────────────────────

function welcomeText(firstName) {
  return (
`👋 *Welcome, ${escMd(firstName)}\\!*

I'm *All Media Downloader* — your all\\-in\\-one bot to download videos from:

• 🎵 *TikTok* \\(no watermark\\)
• 📸 *Instagram* \\(Reels / Posts\\)
• 📘 *Facebook* \\(Videos\\)

Choose a mode below to get started ⬇️`
  );
}

function helpText() {
  return (
`ℹ️ *How to Use All Media Downloader*

*🔍 Auto Detect Mode*
1\\. Tap *Auto Detect*
2\\. Send any supported video link
3\\. The bot detects the platform & downloads automatically

*🎛️ Manual Mode*
1\\. Tap *Manual Mode*
2\\. Select the platform \\(TikTok / Instagram / Facebook\\)
3\\. Send the video link
4\\. Receive the video ✅

*📌 Supported Platforms*
• TikTok — no\\-watermark download
• Instagram — Reels, Posts, IGTV
• Facebook — Public videos

*⚠️ Notes*
• Only public videos are supported
• Max upload size: 50 MB via Telegram
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
📧 *Email:*
  • ${escMd(DEV.email1)}
  • ${escMd(DEV.email2)}
▶️ *YouTube:* [mdmainulislaminfo](${DEV.youtube})

📢 *Channel:* [mainul\\_x\\_official](${DEV.channel})
👥 *Group:* [mainul\\_x\\_official\\_gc](${DEV.group})

📜 *License:* MIT License`
  );
}

function resultCaption(info) {
  const title    = escMd(info.title    || 'Unknown');
  const platform = escMd(info.platform || 'Unknown');
  const size     = escMd(info.size     || 'Unknown');
  const duration = escMd(info.duration || 'Unknown');

  return (
`*${title}*

🌐 *Platform:* ${platform}
🎥 *Format:* MP4
⚖️ *Size:* ${size}
⏱️ *Duration:* ${duration}

🤖 *Bot:* All Media Downloader
👨‍💻 *Dev:* ${escMd(DEV.handle)}`
  );
}

// ── MarkdownV2 escape helper ──────────────────────────────────────────────────

function escMd(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

module.exports = {
  MAIN_MENU,
  PLATFORM_MENU,
  BACK_MENU,
  welcomeText,
  helpText,
  developerText,
  resultCaption,
  escMd,
};
