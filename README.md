<div align="center">

# 🎬 ***All Media Downloader Bot***

### ***Download TikTok • Instagram • Facebook videos — Free & Fast!***

<br/>

[![Telegram Bot](https://img.shields.io/badge/🤖_Try_Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/allmedia_downloaderx_bot)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![python-telegram-bot](https://img.shields.io/badge/python--telegram--bot-20.7-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://python-telegram-bot.org)
[![Powered by API](https://img.shields.io/badge/Powered_by-All_Media_Downloader_API-FF6A1A?style=for-the-badge)](https://all-media-downloader-api.onrender.com)
[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## ***🚀 Try the Live Bot***

<div align="center">

### **[👉 @allmedia_downloaderx_bot](https://t.me/allmedia_downloaderx_bot)**

*Just send a link — get your video back!*

</div>

---

## ***✨ Features***

| Feature | Description |
|:--|:--|
| 🎵 **TikTok** | Download via link |
| 📸 **Instagram** | Reels & posts via link |
| 📘 **Facebook** | Public videos via link |
| 🔍 **Auto Link Detection** | Just paste a link — no menu needed |
| 🌐 **API-Powered** | All video resolution runs on the [All Media Downloader API](https://all-media-downloader-api.onrender.com) — bot stays lightweight, no yt-dlp installed locally |
| 📏 **50MB Guard** | Checks file size before and during download, respecting Telegram's bot upload limit |
| 🛠️ **Admin Panel** | `/admin` — inline stats panel (users, total downloads, per-platform breakdown) |
| 📣 **Broadcast** | `/broadcast <message>` or via the Admin Panel button — sends a message to every known user |
| 💾 **JSON Database** | Simple `database.json` file tracks users & download counts, no external DB needed |
| ℹ️ **About Command** | `/about` — shows developer & contact info |

---

## ***🗂️ Project Structure***

```
📦 all-media-downloader-bot/
├── 🤖 bot.py               — Entry point, registers handlers, runs polling
├── 🎛️  handlers.py          — /start, /about, and link-message handling
├── 🛠️  admin.py             — /admin panel, /broadcast, callback buttons
├── 💾 database.py           — JSON-based user & download persistence
├── 🌐 api_client.py         — Calls the All Media Downloader API
├── ⬇️  video_handler.py     — Streams video from CDN URL to a temp file, enforces 50MB limit
├── 🔍 platform_detect.py    — Detects supported links (TikTok/Instagram/Facebook)
├── 👨‍💻 developer_info.py    — Developer/contact info shown in /about
├── ⚙️  config.py             — Bot token, admin IDs, API config, limits
├── 📄 requirements.txt
├── 📄 Procfile
└── 📄 render.yaml
```

> This bot is a **Python worker** (not a webhook/Express server) — it runs on
> `python-telegram-bot`'s polling mode. See `Procfile` / `render.yaml`, which
> deploy it as a Render **worker**, not a web service.

---

## ***🛠️ Tech Stack***

| Tool | Purpose |
|:--|:--|
| **Python 3.11+** | Runtime |
| **python-telegram-bot v20** | Telegram Bot framework (async, polling mode) |
| **requests** | HTTP calls to the download API & video CDN |
| **All Media Downloader API** | External video resolution engine (hosted separately) |
| **JSON file (`database.json`)** | Lightweight persistence for users/stats |
| **Render (Worker)** | Free cloud hosting |

---

## ***🚀 Deploy on Render (Free Plan)***

### ***Step 1 — Fork this repo***

```bash
git clone https://github.com/YOUR_USERNAME/all-media-downloader-bot.git
cd all-media-downloader-bot
```

### ***Step 2 — Create a Telegram Bot***

1. Open [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the steps
3. Copy your **bot token**

### ***Step 3 — Deploy on Render***

1. Go to [render.com](https://render.com) → **New → Background Worker**
2. Connect your forked repo — Render will pick up `render.yaml` automatically
3. Or set manually:

| Setting | Value |
|:--|:--|
| **Environment** | `Python` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python bot.py` |

### ***Step 4 — Set Environment Variables***

| Key | Value | Required |
|:--|:--|:--|
| `BOT_TOKEN` | Token from BotFather | ✅ |
| `ADMIN_IDS` | Extra admin Telegram IDs, comma-separated | ❌ Optional (one admin ID is already hardcoded in `config.py`) |
| `API_BASE_URL` | `https://all-media-downloader-api.onrender.com` | ❌ Optional (has default) |
| `API_KEY` | API key for the All Media Downloader API | ❌ Optional (has default) |

### ***Step 5 — Deploy & Done!***

This is a **worker**, not a web service — no webhook URL needed. It connects
to Telegram via polling on startup. ✅

---

## ***💻 Local Development***

```bash
# 1. Clone the repo
git clone https://github.com/M41NUL/all-media-downloader-bot.git
cd all-media-downloader-bot

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your bot token
export BOT_TOKEN="your_bot_token_here"

# 4. Run the bot
python bot.py
```

---

## ***🤖 Bot Commands***

| Command | Description | Access |
|:--|:--|:--|
| `/start` | Show welcome message | Everyone |
| `/about` | Show developer & contact info | Everyone |
| `/admin` | Open the admin panel (stats, refresh, broadcast) | Admin only |
| `/broadcast <message>` | Send a message to every known user | Admin only |

**Just paste a supported link** (TikTok / Instagram / Facebook) — no command needed.

---

## ***🛠️ Admin Panel***

Admin access is controlled by `ADMIN_IDS` in `config.py` (with an optional
`ADMIN_IDS` env var to add more admins without editing code).

`/admin` opens an inline panel showing:
- 👥 Total users
- ⬇️ Total downloads
- 📊 Downloads broken down by platform
- 🔄 Refresh button
- 📣 Broadcast button — tap it, then send your message (or `/cancel` to abort)

You can also broadcast directly with `/broadcast Your message here`.

---

## ***⚠️ Notes & Limitations***

> - **Public content only** — private posts are not supported
> - **Max file size: 50 MB** — Telegram bot upload limit
> - **Render free plan** worker can sleep/restart on inactivity depending on plan type — check Render's current free-tier policy
> - This bot depends on the [All Media Downloader API](https://all-media-downloader-api.onrender.com) being online — if the API is down or sleeping, downloads will fail until it wakes up
> - `database.json` is stored on local disk — on Render's free plan this **does not persist across redeploys** (no persistent disk on free tier). For permanent stats, attach a Render Disk or move to an external DB later.

---

## ***👨‍💻 Developer & Credits***

<div align="center">

### ***Md. Mainul Islam***
#### ***CODEX-M41NUL***

*Full-Stack Developer & Bot Creator*

<br/>

[![Telegram](https://img.shields.io/badge/Telegram-@mdmainulislaminfo-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/mdmainulislaminfo)
[![GitHub](https://img.shields.io/badge/GitHub-M41NUL-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/M41NUL)
[![YouTube](https://img.shields.io/badge/YouTube-codexm41nul-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@codexm41nul)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-+8801308850528-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/8801308850528)

<br/>

[![Channel](https://img.shields.io/badge/📢_Channel-codexm41nul-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/codexm41nul)
[![Group](https://img.shields.io/badge/👥_Group-codex__m41nul-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/codex_m41nul)

<br/>

📧 **Email:** [devmainulislam@gmail.com](mailto:devmainulislam@gmail.com)

</div>

---

## ***📜 License***

<div align="center">

This project is licensed under the **MIT License**.

```
MIT License — © 2026 Md. Mainul Islam (CODEX-M41NUL)
Free to use, modify, and distribute with attribution.
```

</div>

---

<div align="center">

### ***⭐ If this project helped you, please give it a star!***

***Made with ❤️ by [Md. Mainul Islam](https://github.com/M41NUL)***

</div>
