/**
 * ============================================
 * All Media Downloader Bot - Config
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

module.exports = {
  // ── Bot ────────────────────────────────────────────────────────────────────
  BOT_TOKEN   : process.env.BOT_TOKEN   || '',
  ADMIN_ID    : process.env.ADMIN_ID    || '',
  WEBHOOK_URL : process.env.WEBHOOK_URL || '',
  PORT        : parseInt(process.env.PORT || '3000', 10),

  // ── Developer info ─────────────────────────────────────────────────────────
  DEV: {
    name      : 'Md. Mainul Islam',
    owner     : 'MAINUL - X',
    telegram  : 'https://t.me/mdmainulislaminfo',
    handle    : '@mdmainulislaminfo',
    github    : 'https://github.com/M41NUL',
    whatsapp  : '+8801308850528',
    channel   : 'https://t.me/mainul_x_official',
    group     : 'https://t.me/mainul_x_official_gc',
    email1    : 'githubmainul@gmail.com',
    email2    : 'devmainulislam@gmail.com',
    youtube   : 'https://youtube.com/@mdmainulislaminfo',
  },

  // ── Supported platforms ────────────────────────────────────────────────────
  PLATFORMS: {
    TIKTOK    : 'TikTok',
    INSTAGRAM : 'Instagram',
    FACEBOOK  : 'Facebook',
  },

  // ── URL patterns ──────────────────────────────────────────────────────────
  URL_PATTERNS: {
    tiktok    : /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i,
    instagram : /instagram\.com\/(reel|p|tv)\//i,
    facebook  : /facebook\.com|fb\.watch|fb\.com/i,
  },

  // ── API endpoints ─────────────────────────────────────────────────────────
  API: {
    TIKWM   : 'https://www.tikwm.com/api/',
    SNAPTIK : 'https://snaptik.app/abc2.php',
    INSTA   : 'https://api.insta-stories.io/instagram/media/?url=',
    FDOWN   : 'https://fdown.net/download.php',
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  PROGRESS: {
    BAR_LENGTH      : 16,    // total blocks in bar  ██████░░░░░░░░░░
    FILLED_CHAR     : '█',
    EMPTY_CHAR      : '░',
    // Simulated download steps  [percent, speed string]
    DOWNLOAD_STEPS  : [
      [10, '1.2 MB/s'], [25, '1.8 MB/s'], [40, '2.1 MB/s'],
      [55, '2.3 MB/s'], [70, '2.5 MB/s'], [85, '2.4 MB/s'], [95, '2.2 MB/s'],
    ],
    // Simulated send steps  [percent]
    SEND_STEPS      : [20, 40, 60, 75, 90],
    STEP_INTERVAL_MS: 900,   // ms between each step update
  },

  // ── Timeouts ──────────────────────────────────────────────────────────────
  TG_MAX_FILE_MB      : 50,
  DOWNLOAD_TIMEOUT    : 60000,
  ERROR_AUTODELETE_MS : 3000,   // auto-delete error messages after 3 s
};
