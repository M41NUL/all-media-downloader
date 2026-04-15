/**
 * ============================================
 * All Media Downloader Bot - yt-dlp Installer
 * ============================================
 * Developer : Md. Mainul Islam
 * Owner     : MAINUL - X
 * Telegram  : https://t.me/mdmainulislaminfo
 * GitHub    : https://github.com/M41NUL
 * License   : MIT License
 * ============================================
 *
 * This script runs automatically after `npm install` (postinstall hook).
 * It downloads the latest yt-dlp binary for Linux x64 and makes it executable.
 * On Render free plan the binary is placed in ./bin/yt-dlp and added to PATH.
 */

'use strict';

const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

const BIN_DIR  = path.join(__dirname, 'bin');
const BIN_PATH = path.join(BIN_DIR, 'yt-dlp');
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

// ── Check if already installed & fresh (skip re-download) ────────────────────

function isInstalled() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true; // system-wide install found
  } catch (_) {}

  try {
    if (fs.existsSync(BIN_PATH)) {
      fs.accessSync(BIN_PATH, fs.constants.X_OK);
      return true; // local binary found and executable
    }
  } catch (_) {}

  return false;
}

if (isInstalled()) {
  console.log('✅ yt-dlp already installed, skipping download.');
  process.exit(0);
}

// ── Download binary ────────────────────────────────────────────────────────

console.log('📥 Downloading yt-dlp binary...');

if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

const file = fs.createWriteStream(BIN_PATH);

function downloadFile(downloadUrl, dest, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error('❌ Too many redirects');
    process.exit(1);
  }

  https.get(downloadUrl, { headers: { 'User-Agent': 'AllMediaDownloader/2.0' } }, (res) => {
    // Follow redirects (GitHub releases redirect to CDN)
    if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
      console.log(`↩️  Redirect → ${res.headers.location}`);
      return downloadFile(res.headers.location, dest, redirectCount + 1);
    }

    if (res.statusCode !== 200) {
      console.error(`❌ Failed to download yt-dlp: HTTP ${res.statusCode}`);
      process.exit(1);
    }

    res.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        // Make executable
        try {
          fs.chmodSync(BIN_PATH, '755');
          console.log(`✅ yt-dlp installed at ${BIN_PATH}`);

          // Verify
          const version = execSync(`${BIN_PATH} --version`).toString().trim();
          console.log(`🎉 yt-dlp version: ${version}`);
        } catch (err) {
          console.error('❌ Could not make yt-dlp executable:', err.message);
          process.exit(1);
        }
      });
    });
  }).on('error', (err) => {
    fs.unlink(BIN_PATH, () => {});
    console.error('❌ Download error:', err.message);
    process.exit(1);
  });
}

downloadFile(YTDLP_URL, BIN_PATH);
