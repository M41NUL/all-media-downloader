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

const https = require('https');
const http  = require('http');
const url   = require('url');
const { URL_PATTERNS, DOWNLOAD_TIMEOUT } = require('./config');

// ══════════════════════════════════════════════════════════════════════════════
// LOW-LEVEL HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET → parsed JSON
 */
function fetchJSON(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new url.URL(targetUrl);
    const lib     = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname : parsed.hostname,
        path     : parsed.pathname + parsed.search,
        method   : 'GET',
        headers  : {
          'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept'     : 'application/json, text/plain, */*',
          ...headers,
        },
        timeout  : DOWNLOAD_TIMEOUT,
      },
      (res) => {
        // Follow single redirect
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return fetchJSON(res.headers.location, headers).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try   { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Non-JSON response (${res.statusCode}): ${data.slice(0, 120)}`)); }
        });
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

/**
 * POST application/x-www-form-urlencoded → raw text
 */
function fetchPost(targetUrl, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(targetUrl);
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(buf);
    req.end();
  });
}

/**
 * HEAD request → follow redirect → return final URL
 */
function resolveRedirect(shortUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new url.URL(shortUrl);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const req    = lib.request(
        {
          hostname : parsed.hostname,
          path     : parsed.pathname + parsed.search,
          method   : 'HEAD',
          headers  : { 'User-Agent': 'Mozilla/5.0' },
          timeout  : 10000,
        },
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
  // ── API 1: tikwm.com (best, no watermark, HD) ─────────────────────────────
  try {
    const data = await fetchJSON(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`
    );
    if (data?.code === 0 && data?.data) {
      const v = data.data;
      const videoLink = v.hdplay || v.play || v.wmplay;
      if (videoLink) {
        return {
          url      : videoLink,
          title    : v.title    || 'TikTok Video',
          size     : formatSize(v.size || v.hd_size || 0),
          duration : formatDuration(v.duration || 0),
          platform : 'TikTok',
        };
      }
    }
  } catch (_) {}

  // ── API 2: tikcdn.io ──────────────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://tikcdn.io/ssstik/${encodeURIComponent(videoUrl)}`
    );
    if (data?.video) {
      return {
        url      : data.video,
        title    : data.title || 'TikTok Video',
        size     : 'Unknown',
        duration : formatDuration(data.duration || 0),
        platform : 'TikTok',
      };
    }
  } catch (_) {}

  // ── API 3: SnapTik scrape fallback ────────────────────────────────────────
  try {
    const html  = await fetchPost(
      'https://snaptik.app/abc2.php',
      `url=${encodeURIComponent(videoUrl)}&lang=en`,
      { Referer: 'https://snaptik.app/', Origin: 'https://snaptik.app' }
    );
    const match = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (match) {
      return {
        url      : match[1].replace(/&amp;/g, '&'),
        title    : 'TikTok Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'TikTok',
      };
    }
  } catch (_) {}

  throw new Error('Could not download TikTok video. The link may be private or expired.');
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM  —  multiple working APIs with fallback chain
// ══════════════════════════════════════════════════════════════════════════════

async function downloadInstagram(videoUrl) {

  // ── API 1: SaveIG / ssinstagram ───────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://ssinstagram.com/api/ajaxSearch`,
      { 'Content-Type': 'application/json' }
    );
    // this endpoint needs POST — handled below in API 2 style scrape
  } catch (_) {}

  // ── API 2: instasave.io (public, no key) ──────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://instasave.io/api/?url=${encodeURIComponent(videoUrl)}`
    );
    const video = Array.isArray(data)
      ? data.find(i => i.type === 'video')
      : (data?.type === 'video' ? data : null);
    if (video?.url) {
      return {
        url      : video.url,
        title    : video.title || 'Instagram Video',
        size     : formatSize(video.size || 0),
        duration : formatDuration(video.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // ── API 3: snapinsta.app (scrape) ─────────────────────────────────────────
  try {
    const html = await fetchPost(
      'https://snapinsta.app/action.php',
      `url=${encodeURIComponent(videoUrl)}&lang=en`,
      {
        Referer : 'https://snapinsta.app/',
        Origin  : 'https://snapinsta.app',
      }
    );
    // Response is JSON with `data` field containing HTML
    const parsed = JSON.parse(html);
    const inner  = parsed?.data || parsed?.html || '';
    // Extract MP4 download URL
    const mp4Match = inner.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i)
                  || inner.match(/href="(https?:\/\/[^"]+)"\s+[^>]*download/i);
    if (mp4Match) {
      return {
        url      : mp4Match[1].replace(/&amp;/g, '&'),
        title    : 'Instagram Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // ── API 4: saveig.app ─────────────────────────────────────────────────────
  try {
    const html = await fetchPost(
      'https://saveig.app/api/ajaxSearch',
      `q=${encodeURIComponent(videoUrl)}&t=media&lang=en`,
      {
        Referer : 'https://saveig.app/',
        Origin  : 'https://saveig.app',
        'X-Requested-With': 'XMLHttpRequest',
      }
    );
    const parsed  = JSON.parse(html);
    const content = parsed?.data || '';
    const mp4     = content.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (mp4) {
      return {
        url      : mp4[1].replace(/&amp;/g, '&'),
        title    : 'Instagram Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // ── API 5: instagram-downloader via igram.io ──────────────────────────────
  try {
    const html = await fetchPost(
      'https://igram.io/api/convert',
      `url=${encodeURIComponent(videoUrl)}`,
      {
        Referer : 'https://igram.io/',
        Origin  : 'https://igram.io',
      }
    );
    const parsed = JSON.parse(html);
    // igram returns { medias: [{ url, quality }] }
    const medias = parsed?.medias || parsed?.data?.medias || [];
    const best   = medias.find(m => m.url && /video/i.test(m.type || m.quality || ''))
                || medias[0];
    if (best?.url) {
      return {
        url      : best.url,
        title    : 'Instagram Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // ── API 6: instavideosave.com ─────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://instavideosave.com/?url=${encodeURIComponent(videoUrl)}`
    );
    if (data?.video_url || data?.url) {
      return {
        url      : data.video_url || data.url,
        title    : data.title || 'Instagram Video',
        size     : formatSize(data.filesize || 0),
        duration : formatDuration(data.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // ── API 7: reelsaver.net ──────────────────────────────────────────────────
  try {
    const html = await fetchPost(
      'https://reelsaver.net/wp-json/aio-dl/video-data/',
      `url=${encodeURIComponent(videoUrl)}`,
      {
        Referer : 'https://reelsaver.net/',
        Origin  : 'https://reelsaver.net',
      }
    );
    const parsed = JSON.parse(html);
    const medias = parsed?.medias || [];
    const video  = medias.find(m => m.url);
    if (video?.url) {
      return {
        url      : video.url,
        title    : parsed.title || 'Instagram Video',
        size     : formatSize(parsed.size || 0),
        duration : formatDuration(parsed.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  throw new Error(
    'Could not download Instagram video.\n\n' +
    '• Make sure the post is public\n' +
    '• Try again in a few seconds\n' +
    '• Reels work best — check the link format'
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FACEBOOK
// ══════════════════════════════════════════════════════════════════════════════

async function downloadFacebook(videoUrl) {
  // Resolve short links first
  let finalUrl = videoUrl;
  if (/fb\.watch/i.test(videoUrl)) {
    finalUrl = await resolveRedirect(videoUrl);
  }

  // ── API 1: fdown.net ──────────────────────────────────────────────────────
  try {
    const html   = await fetchPost(
      'https://fdown.net/download.php',
      `URLz=${encodeURIComponent(finalUrl)}`,
      { Referer: 'https://fdown.net/', Origin: 'https://fdown.net' }
    );
    const hd = html.match(/id="hdlink"[^>]*href="([^"]+)"/i);
    const sd = html.match(/id="sdlink"[^>]*href="([^"]+)"/i);
    const lk = hd || sd;
    if (lk) {
      return {
        url      : lk[1].replace(/&amp;/g, '&'),
        title    : 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // ── API 2: savefrom.net style ─────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://sfrom.net/api/button/?lang=en&app_id=&hash=&url=${encodeURIComponent(finalUrl)}`
    );
    const link = data?.url?.[0]?.url;
    if (link) {
      return {
        url      : link,
        title    : data.meta?.title || 'Facebook Video',
        size     : 'Unknown',
        duration : formatDuration(data.meta?.duration || 0),
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // ── API 3: getfvid.com ────────────────────────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://getfvid.com/api?url=${encodeURIComponent(finalUrl)}&format=json`
    );
    const link = data?.links?.hd || data?.links?.sd;
    if (link) {
      return {
        url      : link,
        title    : data.title || 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // ── API 4: fbdown.net ─────────────────────────────────────────────────────
  try {
    const html  = await fetchPost(
      'https://fbdown.net/download.php',
      `url=${encodeURIComponent(finalUrl)}`,
      { Referer: 'https://fbdown.net/', Origin: 'https://fbdown.net' }
    );
    const match = html.match(/href="(https:\/\/video[^"]+)"/i);
    if (match) {
      return {
        url      : match[1].replace(/&amp;/g, '&'),
        title    : 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  throw new Error(
    'Could not download Facebook video.\n\n' +
    '• The video must be public\n' +
    '• Try a direct facebook.com/… link instead of a share link'
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
