/**
 * ============================================
 * All Media Downloader Bot - Database
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
    stats     : { total: 0, tiktok: 0, instagram: 0, facebook: 0 },
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
 */
function recordDownload(userId, platform) {
  const db  = load();
  const uid = String(userId);

  // Increment global stats
  db.stats.total += 1;
  if (platform === 'tiktok')    db.stats.tiktok    += 1;
  if (platform === 'instagram') db.stats.instagram += 1;
  if (platform === 'facebook')  db.stats.facebook  += 1;

  // Increment per-user
  if (db.users[uid]) db.users[uid].downloads += 1;

  save(db);
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
 * Return all registered users as an array.
 */
function getAllUsers() {
  const db = load();
  return Object.values(db.users);
}

module.exports = { upsertUser, recordDownload, getStats, getAllUsers };
