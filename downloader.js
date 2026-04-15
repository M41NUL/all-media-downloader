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
 * platform: 'tiktok' | 'instagram' | 'facebook' — used to pick best format flag
 * Returns parsed JSON object from yt-dlp output.
 */
function ytdlpInfo(videoUrl, platform = 'generic') {
  return new Promise((resolve, reject) => {

    
    const formatArgs = platform === 'facebook'
      ? ['--format', 'bestvideo[ext=mp4][height>=720]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best']
      : [];

    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--socket-timeout', '30',
      ...formatArgs,
      // Instagram cookies support
      ...(process.env.INSTAGRAM_COOKIES
        ? ['--cookies', process.env.INSTAGRAM_COOKIES]
        : []
      ),
      videoUrl,
    ];

    execFile('yt-dlp', args, { timeout: 55000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(err.message || stderr || 'yt-dlp failed'));
      try {
        const firstLine = stdout.trim().split('\n')[0];
        resolve(JSON.parse(firstLine));
      } catch {
        reject(new Error('yt-dlp returned invalid JSON'));
      }
    });
  });
}


function pickBestFormat(info, platform = 'generic') {
  if (!info) return null;

  // Direct URL (no formats array) — return as-is
  if (info.url && !info.formats) return info.url;

  const formats = info.formats || [];

  // ── Priority 1: TikTok no-watermark mp4 (video+audio combined) ──────────
  if (platform === 'tiktok') {
    const noWatermark = formats.find(f =>
      (f.format_id === 'download' ||
        /no.?watermark|nowm|hd/i.test(f.format_note || '')) &&
      f.ext === 'mp4' &&
      f.vcodec !== 'none' &&
      f.acodec !== 'none' &&
      f.url &&
      !f.url.includes('.m3u8')
    );
    if (noWatermark?.url) return noWatermark.url;
  }

  // ── Priority 2 (Facebook): Height >= 720 combined mp4 ────────────────────
  if (platform === 'facebook') {
    const hdCombined = formats
      .filter(f =>
        f.ext === 'mp4' &&
        f.vcodec !== 'none' &&
        f.acodec !== 'none' &&
        (f.height || 0) >= 720 &&
        f.url &&
        !f.url.includes('.m3u8') &&
        !f.url.includes('.webm')
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    if (hdCombined[0]?.url) return hdCombined[0].url;

    // Facebook SD fallback (combined)
    const sdCombined = formats
      .filter(f =>
        f.ext === 'mp4' &&
        f.vcodec !== 'none' &&
        f.acodec !== 'none' &&
        f.url &&
        !f.url.includes('.m3u8') &&
        !f.url.includes('.webm')
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    if (sdCombined[0]?.url) return sdCombined[0].url;
  }

  // ── Priority 3: Best combined mp4 (video+audio, highest resolution) ──────
  const combined = formats
    .filter(f =>
      f.ext === 'mp4' &&
      f.vcodec !== 'none' &&
      f.acodec !== 'none' &&
      f.url &&
      !f.url.includes('.m3u8') &&
      !f.url.includes('.webm')
    )
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  if (combined[0]?.url) return combined[0].url;

  // ── Priority 4: যেকোনো mp4 (last resort) ─────────────────────────────────
  const anyMp4 = formats.find(f =>
    f.ext === 'mp4' &&
    f.url &&
    !f.url.includes('.m3u8')
  );
  if (anyMp4?.url) return anyMp4.url;

  // ── Fallback: info.url (original) ────────────────────────────────────────
  return info.url || null;
}


function downloadBuffer(videoUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const doRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));

      let parsed;
      try { parsed = new urlModule.URL(url); }
      catch (e) { return reject(new Error('Invalid URL: ' + url)); }

      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname : parsed.hostname,
          path     : parsed.pathname + parsed.search,
          method   : 'GET',
          headers  : {
            'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept'          : 'video/mp4,video/*,*/*',
            'Accept-Encoding' : 'identity',
            'Connection'      : 'keep-alive',
            ...extraHeaders,
          },
          timeout  : DOWNLOAD_TIMEOUT,
        },
        (res) => {
          // Redirect handle
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            return doRequest(res.headers.location, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} while downloading video`));
          }

          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end',  ()    => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }
      );

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
      req.end();
    };

    doRequest(videoUrl);
  });
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

  // ── Primary: yt-dlp (no watermark mp4) ───────────────────────────────────
  try {
    const info    = await ytdlpInfo(videoUrl, 'tiktok');
    const bestUrl = pickBestFormat(info, 'tiktok');
    if (bestUrl) {
      const buffer = await downloadBuffer(bestUrl, {
        'Referer' : 'https://www.tiktok.com/',
        'Origin'  : 'https://www.tiktok.com',
      });
      return {
        buffer,
        title    : info.title || info.description || 'TikTok Video',
        size     : formatSize(buffer.length),
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
      if (lnk) {
        const buffer = await downloadBuffer(lnk, {
          'Referer' : 'https://www.tikwm.com/',
        });
        return {
          buffer,
          title    : v.title || 'TikTok Video',
          size     : formatSize(buffer.length),
          duration : formatDuration(v.duration || 0),
          platform : 'TikTok',
        };
      }
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
    if (match) {
      const cleanUrl = match[1].replace(/&amp;/g, '&');
      const buffer   = await downloadBuffer(cleanUrl, {
        'Referer' : 'https://snaptik.app/',
      });
      return {
        buffer,
        title    : 'TikTok Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'TikTok',
      };
    }
  } catch (_) {}

  throw new Error('Could not download TikTok video. The link may be private or expired.');
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ══════════════════════════════════════════════════════════════════════════════

async function downloadInstagram(videoUrl) {

  // ── Primary: yt-dlp ───────────────────────────────────────────────────────
  try {
    const info    = await ytdlpInfo(videoUrl, 'instagram');
    const bestUrl = pickBestFormat(info, 'instagram');
    if (bestUrl) {
      const buffer = await downloadBuffer(bestUrl, {
        'Referer' : 'https://www.instagram.com/',
      });
      return {
        buffer,
        title    : info.title || info.description?.slice(0, 80) || 'Instagram Video',
        size     : formatSize(buffer.length),
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
    if (mp4) {
      const cleanUrl = mp4[1].replace(/&amp;/g, '&');
      const buffer   = await downloadBuffer(cleanUrl, {
        'Referer' : 'https://snapinsta.app/',
      });
      return {
        buffer,
        title    : 'Instagram Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
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
    if (mp4) {
      const cleanUrl = mp4[1].replace(/&amp;/g, '&');
      const buffer   = await downloadBuffer(cleanUrl, {
        'Referer' : 'https://saveig.app/',
      });
      return {
        buffer,
        title    : 'Instagram Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
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
    if (video?.url) {
      const buffer = await downloadBuffer(video.url, {
        'Referer' : 'https://reelsaver.net/',
      });
      return {
        buffer,
        title    : parsed.title || 'Instagram Video',
        size     : formatSize(buffer.length),
        duration : formatDuration(parsed.duration || 0),
        platform : 'Instagram',
      };
    }
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


  try {
    const info    = await ytdlpInfo(finalUrl, 'facebook');
    const bestUrl = pickBestFormat(info, 'facebook');
    if (bestUrl) {
      const buffer = await downloadBuffer(bestUrl, {
        'Referer' : 'https://www.facebook.com/',
      });
      return {
        buffer,
        title    : info.title || 'Facebook Video',
        size     : formatSize(buffer.length),
        duration : formatDuration(info.duration || 0),
        platform : 'Facebook',
      };
    }
  } catch (ytErr) {
    console.warn('[Facebook yt-dlp]', ytErr.message);
  }

  
  try {
    const html = await fetchPost(
      'https://fdown.net/download.php',
      `URLz=${encodeURIComponent(finalUrl)}`,
      { Referer: 'https://fdown.net/', Origin: 'https://fdown.net' }
    );

    
    const hd =
      html.match(/id="hdlink"[^>]*href="([^"]+)"/i) ||
      html.match(/href="([^"]+)"[^>]*id="hdlink"/i) ||
      html.match(/quality[^>]*hd[^>]*href="([^"]+\.mp4[^"]*)"/i) ||
      html.match(/<a[^>]+href="(https?:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*HD/i);

    const sd =
      html.match(/id="sdlink"[^>]*href="([^"]+)"/i) ||
      html.match(/href="([^"]+)"[^>]*id="sdlink"/i) ||
      html.match(/<a[^>]+href="(https?:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*SD/i);

    const lk = hd || sd; 
    if (lk) {
      const cleanUrl = lk[1].replace(/&amp;/g, '&');
      const buffer   = await downloadBuffer(cleanUrl, {
        'Referer' : 'https://fdown.net/',
      });
      return {
        buffer,
        title    : 'Facebook Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // ── Fallback 2: getfvid.com — HD priority explicit ────────────────────────
  try {
    const data = await fetchJSON(
      `https://getfvid.com/api?url=${encodeURIComponent(finalUrl)}&format=json`
    );
    
    const link = data?.links?.hd || data?.links?.sd;
    if (link) {
      const buffer = await downloadBuffer(link, {
        'Referer' : 'https://getfvid.com/',
      });
      return {
        buffer,
        title    : data.title || 'Facebook Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (_) {}

  // ── Fallback 3: fbdownloader.com ─────────────────────────────────────────
  
  try {
    const raw  = await fetchPost(
      'https://fbdownloader.com/api/data',
      `url=${encodeURIComponent(finalUrl)}`,
      {
        Referer            : 'https://fbdownloader.com/',
        Origin             : 'https://fbdownloader.com',
        'X-Requested-With' : 'XMLHttpRequest',
      }
    );
    const parsed = JSON.parse(raw);
    
    const hdUrl  = parsed?.hd || parsed?.links?.hd;
    const sdUrl  = parsed?.sd || parsed?.links?.sd || parsed?.url;
    const link   = hdUrl || sdUrl;
    if (link) {
      const cleanUrl = link.replace(/&amp;/g, '&');
      const buffer   = await downloadBuffer(cleanUrl, {
        'Referer' : 'https://fbdownloader.com/',
      });
      return {
        buffer,
        title    : parsed.title || 'Facebook Video',
        size     : formatSize(buffer.length),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
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
