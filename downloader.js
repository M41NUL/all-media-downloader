/**
 * ============================================
 * All Media Downloader Bot - Downloader
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

const { execFile }  = require('child_process');
const https         = require('https');
const http          = require('http');
const urlModule     = require('url');
const { URL_PATTERNS, DOWNLOAD_TIMEOUT } = require('./config');

// ══════════════════════════════════════════════════════════════════════════════
// YT-DLP ENGINE  (primary — works for Instagram, TikTok, Facebook)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run yt-dlp with --dump-json to extract video metadata + direct URL.
 * Returns parsed JSON object from yt-dlp output.
 */
function ytdlpInfo(videoUrl) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',           // print JSON info, don't download
      '--no-playlist',         // single video only
      '--no-warnings',
      '--quiet',
      '--socket-timeout', '30',
      // For Instagram: use cookies from environment if set
      ...(process.env.INSTAGRAM_COOKIES
        ? ['--cookies', process.env.INSTAGRAM_COOKIES]
        : []
      ),
      videoUrl,
    ];

    execFile('yt-dlp', args, { timeout: 55000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message || stderr || 'yt-dlp failed'));
      try {
        // yt-dlp may output multiple JSON lines for playlists — take first
        const firstLine = stdout.trim().split('\n')[0];
        resolve(JSON.parse(firstLine));
      } catch {
        reject(new Error('yt-dlp returned invalid JSON'));
      }
    });
  });
}

/**
 * Extract best video URL from yt-dlp info object.
 * Prefers formats without watermark (for TikTok).
 */
function pickBestFormat(info) {
  if (!info) return null;

  // Direct URL on the info object
  if (info.url && !info.formats) return info.url;

  const formats = info.formats || [];

  // For TikTok: prefer format_id 'download' (no watermark) or 'hd' variants
  const noWatermark = formats.find(f =>
    f.format_id === 'download' ||
    (f.format_note && /no.?watermark|nowm|hd/i.test(f.format_note))
  );
  if (noWatermark?.url) return noWatermark.url;

  // Best combined video+audio by resolution
  const combined = formats
    .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  if (combined[0]?.url) return combined[0].url;

  // Best video-only (fallback)
  const videoOnly = formats
    .filter(f => f.vcodec !== 'none' && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  if (videoOnly[0]?.url) return videoOnly[0].url;

  return info.url || null;
}

// ══════════════════════════════════════════════════════════════════════════════
// HTTP HELPERS  (used for API fallbacks)
// ══════════════════════════════════════════════════════════════════════════════

function fetchJSON(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlModule.URL(targetUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname : parsed.hostname,
        path     : parsed.pathname + parsed.search,
        method   : 'GET',
        headers  : {
          'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept'     : 'application/json, */*',
          ...headers,
        },
        timeout  : DOWNLOAD_TIMEOUT,
      },
      (res) => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          return fetchJSON(res.headers.location, headers).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try   { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Non-JSON (${res.statusCode})`)); }
        });
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function fetchPost(targetUrl, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlModule.URL(targetUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const buf    = Buffer.from(body);

    const req = lib.request(
      {
        hostname : parsed.hostname,
        path     : parsed.pathname + parsed.search,
        method   : 'POST',
        headers  : {
          'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type'   : 'application/x-www-form-urlencoded',
          'Content-Length' : buf.length,
          ...headers,
        },
        timeout  : DOWNLOAD_TIMEOUT,
      },
      (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(buf);
    req.end();
  });
}

function resolveRedirect(shortUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new urlModule.URL(shortUrl);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const req    = lib.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 },
        (res) => resolve(res.headers.location || shortUrl)
      );
      req.on('error', () => resolve(shortUrl));
      req.end();
    } catch { resolve(shortUrl); }
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(rawUrl) {
  if (URL_PATTERNS.tiktok.test(rawUrl))    return 'tiktok';
  if (URL_PATTERNS.instagram.test(rawUrl)) return 'instagram';
  if (URL_PATTERNS.facebook.test(rawUrl))  return 'facebook';
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// TIKTOK
// ══════════════════════════════════════════════════════════════════════════════

async function downloadTikTok(videoUrl) {

  // ── Primary: yt-dlp (no watermark) ───────────────────────────────────────
  try {
    const info    = await ytdlpInfo(videoUrl);
    const bestUrl = pickBestFormat(info);
    if (bestUrl) {
      return {
        url      : bestUrl,
        title    : info.title || info.description || 'TikTok Video',
        size     : formatSize(info.filesize || info.filesize_approx || 0),
        duration : formatDuration(info.duration || 0),
        platform : 'TikTok',
      };
    }
  } catch (_) {}

  // ── Fallback 1: tikwm.com ─────────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`
    );
    if (data?.code === 0 && data?.data) {
      const v   = data.data;
      const lnk = v.hdplay || v.play || v.wmplay;
      if (lnk) return {
        url: lnk, title: v.title || 'TikTok Video',
        size: formatSize(v.size || 0), duration: formatDuration(v.duration || 0),
        platform: 'TikTok',
      };
    }
  } catch (_) {}

  // ── Fallback 2: SnapTik scrape ────────────────────────────────────────────
  try {
    const html  = await fetchPost(
      'https://snaptik.app/abc2.php',
      `url=${encodeURIComponent(videoUrl)}&lang=en`,
      { Referer: 'https://snaptik.app/', Origin: 'https://snaptik.app' }
    );
    const match = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (match) return {
      url: match[1].replace(/&amp;/g, '&'), title: 'TikTok Video',
      size: 'Unknown', duration: 'Unknown', platform: 'TikTok',
    };
  } catch (_) {}

  throw new Error('Could not download TikTok video. The link may be private or expired.');
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ══════════════════════════════════════════════════════════════════════════════

async function downloadInstagram(videoUrl) {

  // ── Primary: yt-dlp ───────────────────────────────────────────────────────
  // yt-dlp handles Instagram Reels, Posts, IGTV without needing an API key.
  // For private content set INSTAGRAM_COOKIES env var (Netscape cookie file path).
  try {
    const info    = await ytdlpInfo(videoUrl);
    const bestUrl = pickBestFormat(info);
    if (bestUrl) {
      return {
        url      : bestUrl,
        title    : info.title || info.description?.slice(0, 80) || 'Instagram Video',
        size     : formatSize(info.filesize || info.filesize_approx || 0),
        duration : formatDuration(info.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (ytErr) {
    console.warn('[Instagram yt-dlp]', ytErr.message);
  }

  // ── Fallback 1: snapinsta.app ─────────────────────────────────────────────
  try {
    const raw    = await fetchPost(
      'https://snapinsta.app/action.php',
      `url=${encodeURIComponent(videoUrl)}&lang=en`,
      { Referer: 'https://snapinsta.app/', Origin: 'https://snapinsta.app' }
    );
    const parsed = JSON.parse(raw);
    const inner  = parsed?.data || parsed?.html || '';
    const mp4    = inner.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i)
                || inner.match(/href="(https?:\/\/[^"]+)"\s+[^>]*download/i);
    if (mp4) return {
      url: mp4[1].replace(/&amp;/g, '&'), title: 'Instagram Video',
      size: 'Unknown', duration: 'Unknown', platform: 'Instagram',
    };
  } catch (_) {}

  // ── Fallback 2: saveig.app ────────────────────────────────────────────────
  try {
    const raw    = await fetchPost(
      'https://saveig.app/api/ajaxSearch',
      `q=${encodeURIComponent(videoUrl)}&t=media&lang=en`,
      { Referer: 'https://saveig.app/', Origin: 'https://saveig.app',
        'X-Requested-With': 'XMLHttpRequest' }
    );
    const parsed  = JSON.parse(raw);
    const content = parsed?.data || '';
    const mp4     = content.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (mp4) return {
      url: mp4[1].replace(/&amp;/g, '&'), title: 'Instagram Video',
      size: 'Unknown', duration: 'Unknown', platform: 'Instagram',
    };
  } catch (_) {}

  // ── Fallback 3: reelsaver.net ─────────────────────────────────────────────
  try {
    const raw    = await fetchPost(
      'https://reelsaver.net/wp-json/aio-dl/video-data/',
      `url=${encodeURIComponent(videoUrl)}`,
      { Referer: 'https://reelsaver.net/', Origin: 'https://reelsaver.net' }
    );
    const parsed = JSON.parse(raw);
    const medias = parsed?.medias || [];
    const video  = medias.find(m => m.url);
    if (video?.url) return {
      url: video.url, title: parsed.title || 'Instagram Video',
      size: formatSize(parsed.size || 0), duration: formatDuration(parsed.duration || 0),
      platform: 'Instagram',
    };
  } catch (_) {}

  throw new Error(
    'Could not download Instagram video.\n\n' +
    '• Make sure the post/reel is public\n' +
    '• Try the direct reel URL: instagram.com/reel/XXX'
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FACEBOOK
// ══════════════════════════════════════════════════════════════════════════════

async function downloadFacebook(videoUrl) {
  let finalUrl = videoUrl;
  if (/fb\.watch/i.test(videoUrl)) finalUrl = await resolveRedirect(videoUrl);

  // ── Primary: yt-dlp ───────────────────────────────────────────────────────
  try {
    const info    = await ytdlpInfo(finalUrl);
    const bestUrl = pickBestFormat(info);
    if (bestUrl) {
      return {
        url      : bestUrl,
        title    : info.title || 'Facebook Video',
        size     : formatSize(info.filesize || info.filesize_approx || 0),
        duration : formatDuration(info.duration || 0),
        platform : 'Facebook',
      };
    }
  } catch (ytErr) {
    console.warn('[Facebook yt-dlp]', ytErr.message);
  }

  // ── Fallback 1: fdown.net ─────────────────────────────────────────────────
  try {
    const html = await fetchPost(
      'https://fdown.net/download.php',
      `URLz=${encodeURIComponent(finalUrl)}`,
      { Referer: 'https://fdown.net/', Origin: 'https://fdown.net' }
    );
    const hd = html.match(/id="hdlink"[^>]*href="([^"]+)"/i);
    const sd = html.match(/id="sdlink"[^>]*href="([^"]+)"/i);
    const lk = hd || sd;
    if (lk) return {
      url: lk[1].replace(/&amp;/g, '&'), title: 'Facebook Video',
      size: 'Unknown', duration: 'Unknown', platform: 'Facebook',
    };
  } catch (_) {}

  // ── Fallback 2: getfvid.com ───────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://getfvid.com/api?url=${encodeURIComponent(finalUrl)}&format=json`
    );
    const link = data?.links?.hd || data?.links?.sd;
    if (link) return {
      url: link, title: data.title || 'Facebook Video',
      size: 'Unknown', duration: 'Unknown', platform: 'Facebook',
    };
  } catch (_) {}

  throw new Error(
    'Could not download Facebook video.\n\n' +
    '• The video must be public\n' +
    '• Try a direct facebook.com/… link'
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCHER
// ══════════════════════════════════════════════════════════════════════════════

async function download(videoUrl, forcePlatform = null) {
  const platform = forcePlatform || detectPlatform(videoUrl);
  if (!platform) throw new Error('Unsupported URL. Send a valid TikTok, Instagram, or Facebook link.');

  switch (platform) {
    case 'tiktok'    : return downloadTikTok(videoUrl);
    case 'instagram' : return downloadInstagram(videoUrl);
    case 'facebook'  : return downloadFacebook(videoUrl);
    default          : throw new Error('Unsupported platform.');
  }
}

module.exports = { download, detectPlatform };
