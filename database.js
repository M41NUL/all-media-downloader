/**
 * ============================================
 * All Media Downloader Bot - Database
 * ============================================
 * Developer : Md. Mainul Islam
 * Owner     : CODEX-M41NUL
 * Telegram  : https://t.me/mdmainulislaminfo
 * GitHub    : https://github.com/M41NUL
 * WhatsApp  : +8801308850528
 * Channel   : https://t.me/codexm41nul
 * Group     : https://t.me/codex_m41nul
 * Email     : devmainulislam@gmail.com
 * YouTube   : https://youtube.com/@codexm41nul
 * License   : MIT License
 * ============================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MAX_LOG_ENTRIES = 25;

// ── Helpers ──────────────────────────────────────────────────────────────────

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      return { ...defaultSchema(), ...parsed };
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
      total       : 0,
      tiktok      : 0,
      instagram   : 0,
      facebook    : 0,
      failed      : 0,
      totalTimeMs : 0,
      totalBytes  : 0,
      restarts    : 0,
      lastDeploy  : new Date().toISOString(),
    },
    dailyStats : {},   // { 'YYYY-MM-DD': { count, failed, totalTimeMs, totalBytes } }
    activityLog: [],   // [{ platform, time }]
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDay(db, key) {
  if (!db.dailyStats[key]) {
    db.dailyStats[key] = { count: 0, failed: 0, totalTimeMs: 0, totalBytes: 0 };
  }
  return db.dailyStats[key];
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
 * @param {object} [meta]
 * @param {number} [meta.timeMs]   time taken to download+send, in ms
 * @param {number} [meta.bytes]    file size in bytes
 */
function recordDownload(userId, platform, meta = {}) {
  const db  = load();
  const uid = String(userId);

  // Increment global stats
  db.stats.total += 1;
  if (platform === 'tiktok')    db.stats.tiktok    += 1;
  if (platform === 'instagram') db.stats.instagram += 1;
  if (platform === 'facebook')  db.stats.facebook  += 1;

  if (meta.timeMs) db.stats.totalTimeMs += meta.timeMs;
  if (meta.bytes)  db.stats.totalBytes  += meta.bytes;

  // Increment per-user
  if (db.users[uid]) db.users[uid].downloads += 1;

  // Daily bucket
  const day = ensureDay(db, todayKey());
  day.count += 1;
  if (meta.timeMs) day.totalTimeMs += meta.timeMs;
  if (meta.bytes)  day.totalBytes  += meta.bytes;

  // Activity log (most recent first)
  db.activityLog.unshift({ platform, time: new Date().toISOString() });
  if (db.activityLog.length > MAX_LOG_ENTRIES) {
    db.activityLog = db.activityLog.slice(0, MAX_LOG_ENTRIES);
  }

  save(db);
}

/**
 * Record a failed download attempt (for success-rate calculation).
 * @param {'tiktok'|'instagram'|'facebook'|null} platform
 */
function recordFailure(platform) {
  const db = load();
  db.stats.failed += 1;

  const day = ensureDay(db, todayKey());
  day.failed += 1;

  save(db);
}

/**
 * Bump the restart counter. Call once at process startup.
 */
function recordRestart() {
  const db = load();
  db.stats.restarts   += 1;
  db.stats.lastDeploy  = new Date().toISOString();
  save(db);
  return db.stats;
}

/**
 * Return aggregate statistics.
 */
function getStats() {
  const db = load();
  return {
    totalUsers     : Object.keys(db.users).length,
    totalDownloads : db.stats.total,
    tiktok         : db.stats.tiktok,
    instagram      : db.stats.instagram,
    facebook       : db.stats.facebook,
    failed         : db.stats.failed,
    restarts       : db.stats.restarts,
    lastDeploy     : db.stats.lastDeploy,
    users          : db.users,
  };
}

/**
 * Return all registered users as an array.
 */
function getAllUsers() {
  const db = load();
  return Object.values(db.users);
}

/**
 * Return data needed by the public /api/stats endpoint:
 * success rate, avg time, avg speed, last 7 days breakdown, recent activity.
 */
function getPublicStats() {
  const db = load();
  const totalAttempts = db.stats.total + db.stats.failed;
  const successRate   = totalAttempts > 0
    ? Math.round((db.stats.total / totalAttempts) * 100)
    : null;

  const avgTimeSec = db.stats.total > 0
    ? (db.stats.totalTimeMs / db.stats.total) / 1000
    : null;

  const avgSpeedKbps = (db.stats.totalTimeMs > 0 && db.stats.totalBytes > 0)
    ? (db.stats.totalBytes / 1024) / (db.stats.totalTimeMs / 1000)
    : null;

  // Build last 7 days (oldest -> newest)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = db.dailyStats[key] || { count: 0, failed: 0, totalTimeMs: 0, totalBytes: 0 };
    const dayAttempts = day.count + day.failed;

    last7Days.push({
      label       : DAY_KEYS[d.getDay()],
      count       : day.count,
      avgTimeSec  : day.count > 0 ? +((day.totalTimeMs / day.count) / 1000).toFixed(2) : null,
      successRate : dayAttempts > 0 ? Math.round((day.count / dayAttempts) * 100) : null,
    });
  }

  return {
    users          : Object.keys(db.users).length,
    downloads      : db.stats.total,
    byPlatform     : { tiktok: db.stats.tiktok, instagram: db.stats.instagram, facebook: db.stats.facebook },
    successRate,
    avgTimeSec,
    avgSpeedKbps,
    restarts       : db.stats.restarts,
    lastDeploy     : db.stats.lastDeploy,
    last7Days,
    recentActivity : db.activityLog.slice(0, 5),
  };
}

module.exports = {
  upsertUser,
  recordDownload,
  recordFailure,
  recordRestart,
  getStats,
  getAllUsers,
  getPublicStats,
};
