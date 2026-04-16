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

const { execFile, spawn } = require('child_process');
const https               = require('https');
const http                = require('http');
const urlModule           = require('url');
const fs                  = require('fs');
const path                = require('path');
const os                  = require('os');
const { URL_PATTERNS, DOWNLOAD_TIMEOUT } = require('./config');

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE   = 50 * 1024 * 1024;   // 50 MB — Telegram bot limit
const YTDLP_TIMEOUT   = 120_000;             // 2 min total for yt-dlp process
const SOCKET_TIMEOUT  = '30';               // yt-dlp internal socket timeout (seconds)

// ══════════════════════════════════════════════════════════════════════════════
// YT-DLP ENGINE  (FILE-BASED — no RAM buffer for video download)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run yt-dlp --dump-json to get metadata ONLY.
 * Format args here affect what format yt-dlp *reports* in the JSON,
 * but we do the actual download separately with ytdlpDownload().
 */
function ytdlpInfo(videoUrl, platform = 'generic') {
  return new Promise((resolve, reject) => {

    // ── Format selection per platform ─────────────────────────────────────
    // FIX: Use format strings that guarantee combined audio+video
    // so we always get a single URL with both streams (no merge needed).
    let formatStr;
    if (platform === 'tiktok') {
      // TikTok CDN always serves combined mp4 — no merge needed
      formatStr = 'best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/best';
    } else if (platform === 'facebook') {
      // FIX: height >= 720 fails when height metadata is null.
      // Use tbr (bitrate) fallback chain instead.
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none][height>=720]/' +
        'best[ext=mp4][vcodec!=none][acodec!=none][height>=480]/' +
        'best[ext=mp4][vcodec!=none][acodec!=none]/'              +
        'best[ext=mp4]/best';
    } else if (platform === 'instagram') {
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none]/' +
        'best[ext=mp4]/best';
    } else {
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none]/' +
        'best[ext=mp4]/best';
    }

    const args = [
      '--dump-json',
      '--no-playlist',
      '--playlist-items', '1',
      '--no-warnings',
      '--quiet',
      '--socket-timeout', SOCKET_TIMEOUT,
      '--format', formatStr,
      ...(process.env.INSTAGRAM_COOKIES
        ? ['--cookies', process.env.INSTAGRAM_COOKIES]
        : []),
      videoUrl,
    ];

    // FIX: Kill yt-dlp process after YTDLP_TIMEOUT — prevents zombie hangs
    const proc = execFile(
      'yt-dlp', args,
      { timeout: YTDLP_TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(err.message || stderr || 'yt-dlp failed'));
        try {
          const firstLine = stdout.trim().split('\n')[0];
          resolve(JSON.parse(firstLine));
        } catch {
          reject(new Error('yt-dlp returned invalid JSON'));
        }
      }
    );

    // Extra safety: hard-kill if still alive after timeout
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
    }, YTDLP_TIMEOUT + 5000);
  });
}

/**
 * Download video directly to a temp file using yt-dlp.
 * FIX: Avoids loading the entire video into RAM (no Buffer).
 * Returns the temp file path — caller must delete it after use.
 */
function ytdlpDownload(videoUrl, platform = 'generic') {
  return new Promise((resolve, reject) => {
    const tmpDir  = os.tmpdir();
    const outFile = path.join(tmpDir, `ytdlp_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

    let formatStr;
    if (platform === 'tiktok') {
      formatStr = 'best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/best';
    } else if (platform === 'facebook') {
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none][height>=720]/' +
        'best[ext=mp4][vcodec!=none][acodec!=none][height>=480]/' +
        'best[ext=mp4][vcodec!=none][acodec!=none]/'              +
        'best[ext=mp4]/best';
    } else if (platform === 'instagram') {
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none]/' +
        'best[ext=mp4]/best';
    } else {
      formatStr =
        'best[ext=mp4][vcodec!=none][acodec!=none]/' +
        'best[ext=mp4]/best';
    }

    const args = [
      '--no-playlist',
      '--playlist-items', '1',
      '--no-warnings',
      '--quiet',
      '--socket-timeout', SOCKET_TIMEOUT,
      '--format', formatStr,
      '--merge-output-format', 'mp4',   // ensure final container = mp4
      '--output', outFile,
      ...(process.env.INSTAGRAM_COOKIES
        ? ['--cookies', process.env.INSTAGRAM_COOKIES]
        : []),
      videoUrl,
    ];

    // FIX: Use spawn so we can kill the process reliably on timeout
    const proc   = spawn('yt-dlp', args);
    let   stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const killer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      reject(new Error('yt-dlp download timed out'));
    }, YTDLP_TIMEOUT);

    proc.on('close', (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      }
      if (!fs.existsSync(outFile)) {
        return reject(new Error('yt-dlp finished but output file not found'));
      }
      // FIX: Check file size before returning — reject if > 50 MB
      const stat = fs.statSync(outFile);
      if (stat.size > MAX_FILE_SIZE) {
        fs.unlink(outFile, () => {});
        return reject(new Error(
          `Video is too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). ` +
          `Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`
        ));
      }
      resolve(outFile);
    });

    proc.on('error', (e) => {
      clearTimeout(killer);
      reject(e);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// HTTP HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Download a URL to a temp file (streaming — no RAM buffer).
 * FIX: Replaces downloadBuffer() — avoids loading video into RAM.
 */
function downloadToFile(videoUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const tmpDir  = os.tmpdir();
    const outFile = path.join(tmpDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

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
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            return doRequest(res.headers.location, redirectCount + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} while downloading video`));
          }

          // FIX: Size guard — check Content-Length header before streaming
          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          if (contentLength > MAX_FILE_SIZE) {
            req.destroy();
            return reject(new Error(
              `Video is too large (${(contentLength / 1024 / 1024).toFixed(1)} MB). ` +
              `Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`
            ));
          }

          const fileStream = fs.createWriteStream(outFile);
          let   received   = 0;
          let   aborted    = false;

          res.on('data', (chunk) => {
            received += chunk.length;
            // FIX: Real-time size check during streaming
            if (received > MAX_FILE_SIZE && !aborted) {
              aborted = true;
              req.destroy();
              fileStream.destroy();
              fs.unlink(outFile, () => {});
              reject(new Error(
                `Video exceeded ${MAX_FILE_SIZE / 1024 / 1024} MB limit during download.`
              ));
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            if (!aborted) resolve(outFile);
          });
          fileStream.on('error', (e) => {
            fs.unlink(outFile, () => {});
            reject(e);
          });
          res.on('error', (e) => {
            fs.unlink(outFile, () => {});
            reject(e);
          });
        }
      );

      req.on('error',   (e) => { fs.unlink(outFile, () => {}); reject(e); });
      req.on('timeout', ()  => { req.destroy(); reject(new Error('Download timeout')); });
      req.end();
    };

    doRequest(videoUrl);
  });
}

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
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
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
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(rawUrl) {
  if (URL_PATTERNS.tiktok.test(rawUrl))    return 'tiktok';
  if (URL_PATTERNS.instagram.test(rawUrl)) return 'instagram';
  if (URL_PATTERNS.facebook.test(rawUrl))  return 'facebook';
  return null;
}

// ── Temp file cleanup helper ──────────────────────────────────────────────────

function cleanupFile(filePath) {
  if (filePath) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TIKTOK
// ══════════════════════════════════════════════════════════════════════════════

async function downloadTikTok(videoUrl) {

  // ── Primary: yt-dlp direct file download (combined mp4, no watermark) ────
  // FIX: Use ytdlpDownload() instead of ytdlpInfo() + downloadBuffer()
  try {
    const filePath = await ytdlpDownload(videoUrl, 'tiktok');
    const stat     = fs.statSync(filePath);
    return {
      filePath,
      title    : 'TikTok Video',
      size     : formatSize(stat.size),
      duration : 'Unknown',
      platform : 'TikTok',
    };
  } catch (ytErr) {
    console.warn('[TikTok yt-dlp]', ytErr.message);
  }

  // ── Fallback 1: tikwm.com (HD no-watermark) ───────────────────────────────
  try {
    const data = await fetchJSON(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`
    );
    if (data?.code === 0 && data?.data) {
      const v   = data.data;
      const lnk = v.hdplay || v.play || v.wmplay;
      if (lnk) {
        const filePath = await downloadToFile(lnk, { 'Referer': 'https://www.tikwm.com/' });
        const stat     = fs.statSync(filePath);
        return {
          filePath,
          title    : v.title || 'TikTok Video',
          size     : formatSize(stat.size),
          duration : formatDuration(v.duration || 0),
          platform : 'TikTok',
        };
      }
    }
  } catch (e) {
    console.warn('[TikTok tikwm]', e.message);
  }

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
      const filePath = await downloadToFile(cleanUrl, { 'Referer': 'https://snaptik.app/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : 'TikTok Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'TikTok',
      };
    }
  } catch (e) {
    console.warn('[TikTok snaptik]', e.message);
  }

  throw new Error('Could not download TikTok video. The link may be private or expired.');
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ══════════════════════════════════════════════════════════════════════════════

async function downloadInstagram(videoUrl) {

  // ── Primary: yt-dlp direct file download ─────────────────────────────────
  try {
    const filePath = await ytdlpDownload(videoUrl, 'instagram');
    const stat     = fs.statSync(filePath);
    return {
      filePath,
      title    : 'Instagram Video',
      size     : formatSize(stat.size),
      duration : 'Unknown',
      platform : 'Instagram',
    };
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
      const filePath = await downloadToFile(cleanUrl, { 'Referer': 'https://snapinsta.app/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : 'Instagram Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (e) {
    console.warn('[Instagram snapinsta]', e.message);
  }

  // ── Fallback 2: saveig.app ────────────────────────────────────────────────
  try {
    const raw    = await fetchPost(
      'https://saveig.app/api/ajaxSearch',
      `q=${encodeURIComponent(videoUrl)}&t=media&lang=en`,
      {
        Referer            : 'https://saveig.app/',
        Origin             : 'https://saveig.app',
        'X-Requested-With' : 'XMLHttpRequest',
      }
    );
    const parsed  = JSON.parse(raw);
    const content = parsed?.data || '';
    const mp4     = content.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (mp4) {
      const cleanUrl = mp4[1].replace(/&amp;/g, '&');
      const filePath = await downloadToFile(cleanUrl, { 'Referer': 'https://saveig.app/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : 'Instagram Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'Instagram',
      };
    }
  } catch (e) {
    console.warn('[Instagram saveig]', e.message);
  }

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
      const filePath = await downloadToFile(video.url, { 'Referer': 'https://reelsaver.net/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : parsed.title || 'Instagram Video',
        size     : formatSize(stat.size),
        duration : formatDuration(parsed.duration || 0),
        platform : 'Instagram',
      };
    }
  } catch (e) {
    console.warn('[Instagram reelsaver]', e.message);
  }

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

  // ── Primary: yt-dlp direct file download (HD mp4) ────────────────────────
  try {
    const filePath = await ytdlpDownload(finalUrl, 'facebook');
    const stat     = fs.statSync(filePath);
    return {
      filePath,
      title    : 'Facebook Video',
      size     : formatSize(stat.size),
      duration : 'Unknown',
      platform : 'Facebook',
    };
  } catch (ytErr) {
    console.warn('[Facebook yt-dlp]', ytErr.message);
  }

  // ── Fallback 1: fdown.net (HD priority) ───────────────────────────────────
  try {
    const html = await fetchPost(
      'https://fdown.net/download.php',
      `URLz=${encodeURIComponent(finalUrl)}`,
      { Referer: 'https://fdown.net/', Origin: 'https://fdown.net' }
    );

    const hd =
      html.match(/id="hdlink"[^>]*href="([^"]+)"/i)              ||
      html.match(/href="([^"]+)"[^>]*id="hdlink"/i)              ||
      html.match(/quality[^>]*hd[^>]*href="([^"]+\.mp4[^"]*)"/i) ||
      html.match(/<a[^>]+href="(https?:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*HD/i);

    const sd =
      html.match(/id="sdlink"[^>]*href="([^"]+)"/i)  ||
      html.match(/href="([^"]+)"[^>]*id="sdlink"/i)  ||
      html.match(/<a[^>]+href="(https?:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*SD/i);

    const lk = hd || sd;
    if (lk) {
      const cleanUrl = lk[1].replace(/&amp;/g, '&');
      const filePath = await downloadToFile(cleanUrl, { 'Referer': 'https://fdown.net/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : 'Facebook Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (e) {
    console.warn('[Facebook fdown]', e.message);
  }

  // ── Fallback 2: getfvid.com (HD priority) ────────────────────────────────
  try {
    const data = await fetchJSON(
      `https://getfvid.com/api?url=${encodeURIComponent(finalUrl)}&format=json`
    );
    const link = data?.links?.hd || data?.links?.sd;
    if (link) {
      const filePath = await downloadToFile(link, { 'Referer': 'https://getfvid.com/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : data.title || 'Facebook Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (e) {
    console.warn('[Facebook getfvid]', e.message);
  }

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
      const filePath = await downloadToFile(cleanUrl, { 'Referer': 'https://fbdownloader.com/' });
      const stat     = fs.statSync(filePath);
      return {
        filePath,
        title    : parsed.title || 'Facebook Video',
        size     : formatSize(stat.size),
        duration : 'Unknown',
        platform : 'Facebook',
      };
    }
  } catch (e) {
    console.warn('[Facebook fbdownloader]', e.message);
  }

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

module.exports = { download, detectPlatform, cleanupFile };
