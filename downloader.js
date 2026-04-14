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

const https      = require('https');
const http       = require('http');
const url        = require('url');
const { URL_PATTERNS, API, DOWNLOAD_TIMEOUT } = require('./config');

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Simple JSON GET fetcher with timeout.
 */
function fetchJSON(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed   = new url.URL(targetUrl);
    const lib      = parsed.protocol === 'https:' ? https : http;
    const reqOpts  = {
      hostname : parsed.hostname,
      path     : parsed.pathname + parsed.search,
      method   : options.method || 'GET',
      headers  : {
        'User-Agent' : 'Mozilla/5.0 (compatible; AllMediaBot/1.0)',
        'Accept'     : 'application/json',
        ...(options.headers || {}),
      },
      timeout  : DOWNLOAD_TIMEOUT,
    };

    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try   { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response from API')); }
      });
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * POST form-data fetcher, returns raw text.
 */
function fetchText(targetUrl, formBody, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new url.URL(targetUrl);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const body    = Buffer.from(formBody);

    const reqOpts = {
      hostname : parsed.hostname,
      path     : parsed.pathname + parsed.search,
      method   : 'POST',
      headers  : {
        'User-Agent'     : 'Mozilla/5.0 (compatible; AllMediaBot/1.0)',
        'Content-Type'   : 'application/x-www-form-urlencoded',
        'Content-Length' : body.length,
        ...extraHeaders,
      },
      timeout  : DOWNLOAD_TIMEOUT,
    };

    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

/**
 * Follow redirects and return the final URL (for short links).
 */
function resolveRedirect(shortUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new url.URL(shortUrl);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const req    = lib.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'HEAD' },
        (res) => {
          if (res.headers.location) resolve(res.headers.location);
          else resolve(shortUrl);
        }
      );
      req.on('error', () => resolve(shortUrl));
      req.end();
    } catch {
      resolve(shortUrl);
    }
  });
}

/** Format bytes → human-readable size string */
function formatSize(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** Format seconds → mm:ss or hh:mm:ss */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Detect platform ──────────────────────────────────────────────────────────

/**
 * Detect platform from URL string.
 * @returns {'tiktok'|'instagram'|'facebook'|null}
 */
function detectPlatform(rawUrl) {
  if (URL_PATTERNS.tiktok.test(rawUrl))    return 'tiktok';
  if (URL_PATTERNS.instagram.test(rawUrl)) return 'instagram';
  if (URL_PATTERNS.facebook.test(rawUrl))  return 'facebook';
  return null;
}

// ── TikTok ───────────────────────────────────────────────────────────────────

async function downloadTikTok(videoUrl) {
  // Primary: tikwm API (no-watermark)
  try {
    const apiUrl = `${API.TIKWM}?url=${encodeURIComponent(videoUrl)}&hd=1`;
    const data   = await fetchJSON(apiUrl);

    if (data && data.code === 0 && data.data) {
      const v = data.data;
      return {
        url      : v.play || v.hdplay || v.wmplay,
        title    : v.title    || 'TikTok Video',
        size     : formatSize(v.size || 0),
        duration : formatDuration(v.duration || 0),
        platform : 'TikTok',
      };
    }
  } catch (_) {}

  // Fallback: SnapTik
  try {
    const params = `url=${encodeURIComponent(videoUrl)}&lang=en`;
    const html   = await fetchText(API.SNAPTIK, params);

    // Extract MP4 URL from response HTML
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

  throw new Error('Could not extract TikTok video. The link may be private or expired.');
}

// ── Instagram ────────────────────────────────────────────────────────────────

async function downloadInstagram(videoUrl) {
  try {
    const apiUrl = `${API.INSTA}${encodeURIComponent(videoUrl)}`;
    const data   = await fetchJSON(apiUrl);

    if (data && data.video_url) {
      return {
        url      : data.video_url,
        title    : data.title || data.caption || 'Instagram Video',
        size     : formatSize(data.size || 0),
        duration : formatDuration(data.duration || 0),
        platform : 'Instagram',
      };
    }

    // Some API variants return an array
    if (Array.isArray(data) && data[0] && data[0].video_url) {
      const v = data[0];
      return {
        url      : v.video_url,
        title    : v.title || 'Instagram Video',
        size     : formatSize(v.size || 0),
        duration : formatDuration(v.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  // Fallback: RapidAPI-style public endpoint (no key required)
  try {
    const fallback = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index?url=${encodeURIComponent(videoUrl)}`;
    const data     = await fetchJSON(fallback, {
      headers: {
        'X-RapidAPI-Host' : 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com',
        'X-RapidAPI-Key'  : process.env.RAPIDAPI_KEY || '',
      },
    });
    if (data && data.media) {
      return {
        url      : data.media,
        title    : data.title || 'Instagram Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (_) {}

  throw new Error('Could not extract Instagram video. Make sure the post is public.');
}

// ── Facebook ─────────────────────────────────────────────────────────────────

async function downloadFacebook(videoUrl) {
  try {
    // Resolve fb.watch short links
    let finalUrl = videoUrl;
    if (/fb\.watch/i.test(videoUrl)) {
      finalUrl = await resolveRedirect(videoUrl);
    }

    const params = `URLz=${encodeURIComponent(finalUrl)}`;
    const html   = await fetchText(API.FDOWN, params, {
      Referer : 'https://fdown.net/',
      Origin  : 'https://fdown.net',
    });

    // fdown returns links in anchor tags with id="hdlink" or id="sdlink"
    const hdMatch = html.match(/id="hdlink"[^>]*href="([^"]+)"/i);
    const sdMatch = html.match(/id="sdlink"[^>]*href="([^"]+)"/i);
    const link    = hdMatch ? hdMatch[1] : (sdMatch ? sdMatch[1] : null);

    if (link) {
      return {
        url      : link.replace(/&amp;/g, '&'),
        title    : 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // Fallback: getfvid API
  try {
    const apiUrl = `https://getfvid.com/api?url=${encodeURIComponent(videoUrl)}&format=json`;
    const data   = await fetchJSON(apiUrl);

    if (data && data.links && data.links.hd) {
      return {
        url      : data.links.hd,
        title    : data.title || 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
    if (data && data.links && data.links.sd) {
      return {
        url      : data.links.sd,
        title    : data.title || 'Facebook Video',
        size     : 'Unknown',
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  throw new Error('Could not extract Facebook video. The video may be private or not available.');
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Download video from URL.
 * @param {string} videoUrl
 * @param {'tiktok'|'instagram'|'facebook'|null} [forcePlatform]
 * @returns {Promise<{ url: string, title: string, size: string, duration: string, platform: string }>}
 */
async function download(videoUrl, forcePlatform = null) {
  const platform = forcePlatform || detectPlatform(videoUrl);

  if (!platform) throw new Error('Unsupported URL. Please send a valid TikTok, Instagram, or Facebook link.');

  switch (platform) {
    case 'tiktok'    : return downloadTikTok(videoUrl);
    case 'instagram' : return downloadInstagram(videoUrl);
    case 'facebook'  : return downloadFacebook(videoUrl);
    default          : throw new Error('Unsupported platform.');
  }
}

module.exports = { download, detectPlatform };
