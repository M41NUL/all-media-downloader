/**
 * ============================================
 * All Media Downloader Bot - Database
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

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (_) {}
  return defaultSchema();
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function defaultSchema() {
  return {
    users     : {},   // { userId: { id, username, firstName, joinedAt, downloads } }
    stats     : {
      total: 0, tiktok: 0, instagram: 0, facebook: 0, failed: 0,
      totalTimeMs   : 0,  // sum of every successful download's duration (ms)
      timeCount     : 0,  // how many downloads contributed a duration
      totalSpeedKbps: 0,  // sum of every successful download's speed (KB/s)
      speedCount    : 0,  // how many downloads contributed a speed
    },
    activity  : [],   // [{ platform, time (ISO), success }] — most recent first, capped
    restarts  : 0,
    firstBootAt: null,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register or update a user.
 * @param {{ id: number|string, username?: string, first_name?: string }} from
 */
function upsertUser(from) {
  const db  = load();
  const uid = String(from.id);

  if (!db.users[uid]) {
    db.users[uid] = {
      id        : uid,
      username  : from.username  || null,
      firstName : from.first_name || 'Unknown',
      joinedAt  : new Date().toISOString(),
      downloads : 0,
    };
  } else {
    // Keep info fresh
    db.users[uid].username  = from.username  || db.users[uid].username;
    db.users[uid].firstName = from.first_name || db.users[uid].firstName;
  }

  save(db);
}

/**
 * Record a successful download.
 * @param {string|number} userId
 * @param {'tiktok'|'instagram'|'facebook'} platform
 * @param {number} [durationMs] - how long the download took, in milliseconds
 * @param {number} [fileSizeBytes] - size of the downloaded file, in bytes (used to derive speed)
 */
function recordDownload(userId, platform, durationMs, fileSizeBytes) {
  const db  = load();
  const uid = String(userId);

  // Increment global stats
  db.stats.total += 1;
  if (platform === 'tiktok')    db.stats.tiktok    += 1;
  if (platform === 'instagram') db.stats.instagram += 1;
  if (platform === 'facebook')  db.stats.facebook  += 1;

  // Track duration for avg-time stat (only if a valid number was passed)
  let speedKbps = null;
  if (typeof durationMs === 'number' && isFinite(durationMs) && durationMs >= 0) {
    if (!db.stats.totalTimeMs) db.stats.totalTimeMs = 0;
    if (!db.stats.timeCount)   db.stats.timeCount   = 0;
    db.stats.totalTimeMs += durationMs;
    db.stats.timeCount   += 1;

    // Derive speed (KB/s) if we also know the file size
    if (typeof fileSizeBytes === 'number' && isFinite(fileSizeBytes) && fileSizeBytes > 0 && durationMs > 0) {
      speedKbps = (fileSizeBytes / 1024) / (durationMs / 1000);
      if (!db.stats.totalSpeedKbps) db.stats.totalSpeedKbps = 0;
      if (!db.stats.speedCount)     db.stats.speedCount     = 0;
      db.stats.totalSpeedKbps += speedKbps;
      db.stats.speedCount     += 1;
    }
  }

  // Increment per-user
  if (db.users[uid]) db.users[uid].downloads += 1;

  // Log activity (cap at 100 most recent entries)
  if (!db.activity) db.activity = [];
  db.activity.unshift({
    platform, time: new Date().toISOString(), success: true,
    durationMs: durationMs ?? null, speedKbps,
  });
  db.activity = db.activity.slice(0, 100);

  save(db);
}

/**
 * Record a failed download attempt (for success-rate calculation).
 * @param {'tiktok'|'instagram'|'facebook'|null} platform
 */
function recordFailure(platform) {
  const db = load();
  if (!db.stats.failed) db.stats.failed = 0;
  db.stats.failed += 1;

  if (!db.activity) db.activity = [];
  db.activity.unshift({ platform: platform || null, time: new Date().toISOString(), success: false });
  db.activity = db.activity.slice(0, 100);

  save(db);
}

/**
 * Record a bot process restart/boot. Call once on startup.
 */
function recordRestart() {
  const db = load();
  db.restarts = (db.restarts || 0) + 1;
  if (!db.firstBootAt) db.firstBootAt = new Date().toISOString();
  save(db);
  return { restarts: db.restarts, firstBootAt: db.firstBootAt };
}

/**
 * Return aggregate statistics.
 * @returns {{ totalUsers: number, totalDownloads: number, tiktok: number, instagram: number, facebook: number, users: object }}
 */
function getStats() {
  const db = load();
  return {
    totalUsers     : Object.keys(db.users).length,
    totalDownloads : db.stats.total,
    tiktok         : db.stats.tiktok,
    instagram      : db.stats.instagram,
    facebook       : db.stats.facebook,
    users          : db.users,
  };
}

/**
 * Return everything the status dashboard (public/index.html -> /api/stats) needs.
 */
function getDashboardStats() {
  const db       = load();
  const activity = db.activity || [];

  const totalAttempts = db.stats.total + (db.stats.failed || 0);
  const successRate   = totalAttempts > 0
    ? Math.round((db.stats.total / totalAttempts) * 100)
    : null;

  // Last 7 days — successful downloads per day, that day's avg time (sec),
  // its share of the week's total downloads (%), and its success rate (%).
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const rawDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const dayAll = activity.filter(a => {
      const t = new Date(a.time).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    const daySuccess = dayAll.filter(a => a.success);

    const timed = daySuccess.filter(a => typeof a.durationMs === 'number');
    const avgDayTimeSec = timed.length
      ? (timed.reduce((sum, a) => sum + a.durationMs, 0) / timed.length) / 1000
      : null;

    const daySuccessRate = dayAll.length
      ? Math.round((daySuccess.length / dayAll.length) * 100)
      : null;

    rawDays.push({
      label: dayLabels[d.getDay()],
      count: daySuccess.length,
      avgTimeSec: avgDayTimeSec,
      successRate: daySuccessRate,
    });
  }

  // Each day's share of the week's total successful downloads (%)
  const weekTotal = rawDays.reduce((sum, d) => sum + d.count, 0);
  const days = rawDays.map(d => ({
    ...d,
    percentOfWeek: weekTotal > 0 ? Math.round((d.count / weekTotal) * 100) : 0,
  }));

  const recentActivity = activity
    .filter(a => a.success)
    .slice(0, 5)
    .map(a => ({ platform: a.platform, time: a.time }));

  // Average download time (seconds), based on every timed successful download
  const timeCount = db.stats.timeCount || 0;
  const avgTimeSec = timeCount > 0
    ? (db.stats.totalTimeMs / timeCount) / 1000
    : null;

  // Average download speed (KB/s), based on every successful download with known size
  const speedCount = db.stats.speedCount || 0;
  const avgSpeedKbps = speedCount > 0
    ? db.stats.totalSpeedKbps / speedCount
    : null;

  return {
    status        : 'operational',
    totalUsers    : Object.keys(db.users).length,
    totalDownloads: db.stats.total,
    byPlatform    : {
      tiktok    : db.stats.tiktok,
      instagram : db.stats.instagram,
      facebook  : db.stats.facebook,
    },
    successRate,
    avgTimeSec,
    avgSpeedKbps,
    last7Days     : days,
    recentActivity,
    restarts      : db.restarts || 0,
    lastDeploy    : db.firstBootAt || null,
  };
}

/**
 * Return all registered users as an array.
 */
function getAllUsers() {
  const db = load();
  return Object.values(db.users);
}

module.exports = {
  upsertUser, recordDownload, recordFailure, recordRestart,
  getStats, getDashboardStats, getAllUsers,
};
