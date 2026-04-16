<div align="center">

<img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/bot_profile.jpg" width="120" height="120" style="border-radius:50%"/>

# 🎬 ***All Media Downloader Bot***

### ***Download TikTok • Instagram • Facebook videos — Free & Fast!***

<br/>

[![Telegram Bot](https://img.shields.io/badge/🤖_Try_Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/allmedia_downloaderx_bot)
[![GitHub Stars](https://img.shields.io/github/stars/M41NUL/all-media-downloader?style=for-the-badge&logo=github&color=FFD700&logoColor=black)](https://github.com/M41NUL/all-media-downloader/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/M41NUL/all-media-downloader?style=for-the-badge&logo=github&color=orange)](https://github.com/M41NUL/all-media-downloader/network/members)
[![GitHub Watchers](https://img.shields.io/github/watchers/M41NUL/all-media-downloader?style=for-the-badge&logo=github&color=blue)](https://github.com/M41NUL/all-media-downloader/watchers)

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Telegraf](https://img.shields.io/badge/Telegraf-4.x-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://telegraf.js.org)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-Engine-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

[![GitHub Issues](https://img.shields.io/github/issues/M41NUL/all-media-downloader?style=flat-square&color=red&label=Issues)](https://github.com/M41NUL/all-media-downloader/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/M41NUL/all-media-downloader?style=flat-square&color=blueviolet&label=Pull+Requests)](https://github.com/M41NUL/all-media-downloader/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/M41NUL/all-media-downloader?style=flat-square&color=green)](https://github.com/M41NUL/all-media-downloader/commits)
[![Repo Size](https://img.shields.io/github/repo-size/M41NUL/all-media-downloader?style=flat-square&color=informational)](https://github.com/M41NUL/all-media-downloader)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red?style=flat-square)](https://github.com/M41NUL)

</div>

---

<div align="center">

## ***🚀 Try the Live Bot***

### **[👉 @allmedia_downloaderx_bot](https://t.me/allmedia_downloaderx_bot)**

*Just send a link — get your video in seconds!*

</div>

---

## ***📸 Screenshots***

<div align="center">

| ***Bot Profile*** | ***Bot Intro*** | ***Start Screen*** |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/bot_profile.jpg" width="220"/> | <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/bot_intro.jpg" width="220"/> | <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/bot_start.jpg" width="220"/> |

| ***Auto Detect Mode*** | ***Manual Mode*** | ***Download Result*** |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/auto_detect_mode.jpg" width="220"/> | <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/manual_mode.jpg" width="220"/> | <img src="https://raw.githubusercontent.com/M41NUL/all-media-downloader/main/img/download_result.jpg" width="220"/> |

</div>

---

## ***✨ Features***

<div align="center">

| Feature | Description |
|:--|:--|
| 🎵 **TikTok** | No-watermark HD download |
| 📸 **Instagram** | Reels, Posts, IGTV |
| 📘 **Facebook** | Public videos |
| 🔍 **Auto Detect** | Paste any link — platform auto-detected |
| 🎯 **Manual Mode** | Pick platform manually |
| 📊 **Live Progress Bar** | Real-time `[██████░░░░] 60%` animation |
| 🧹 **Clean Chat** | Auto-deletes messages — only final video stays |
| 📋 **Copy Title** | Tap video title to copy instantly |
| 🛠️ **Admin Panel** | `/admin` — user stats, download counts, broadcast |
| 📣 **Broadcast** | Send message to all users at once |
| ⚡ **yt-dlp Engine** | Most reliable extractor — works where APIs fail |
| 🔄 **Fallback Chain** | Multiple APIs tried if primary fails |
| 🆓 **Free Hosting** | Deployable on Render free plan |
| 🔗 **Webhook Mode** | Production-ready, no polling |

</div>

---

## ***🗂️ Project Structure***

```
📦 all-media-downloader/
├── 🤖 bot.js               — Main entry, Telegraf bot + Express webhook server
├── ⬇️  downloader.js        — yt-dlp engine + API fallback chain
├── 🎛️  buttons.js           — Inline keyboards & MarkdownV2 message templates
├── 🛠️  admin.js             — /admin panel, stats, broadcast system
├── 💾 database.js           — JSON-based user & download persistence
├── ⚙️  config.js            — Central config, constants, yt-dlp PATH injection
├── 📦 install-ytdlp.js      — Auto-downloads yt-dlp binary on deploy
├── 📄 package.json
├── 🔒 .env.example
└── 🙈 .gitignore
```

---

## ***🛠️ Tech Stack & Tools***

<div align="center">

| Tool | Purpose | Badge |
|:--|:--|:--|
| **Node.js 18+** | Runtime | ![Node](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) |
| **Telegraf v4** | Telegram Bot Framework | ![Telegraf](https://img.shields.io/badge/Telegraf-2CA5E0?style=flat-square&logo=telegram&logoColor=white) |
| **yt-dlp** | Video extraction engine | ![yt-dlp](https://img.shields.io/badge/yt--dlp-FF0000?style=flat-square&logo=youtube&logoColor=white) |
| **Express.js** | Webhook HTTP server | ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) |
| **Render** | Free cloud hosting | ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white) |
| **JSON** | Lightweight database | ![JSON](https://img.shields.io/badge/JSON-DB-orange?style=flat-square) |

</div>

---

## ***🚀 Deploy on Render (Free Plan)***

> ***One-click deploy — no paid plan needed!***

### ***Step 1 — Fork this repo***

Click the **Fork** button at the top right of this page, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/all-media-downloader.git
cd all-media-downloader
```

### ***Step 2 — Create a Telegram Bot***

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the steps
3. Copy your **bot token**

### ***Step 3 — Deploy on Render***

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your **forked GitHub repo**
3. Fill in build settings:

| Setting | Value |
|:--|:--|
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

> ✅ `npm install` automatically downloads the **yt-dlp binary** via `postinstall` hook — no manual setup needed!

### ***Step 4 — Set Environment Variables***

In Render → your service → **Environment** tab:

| Key | Value | Required |
|:--|:--|:--|
| `BOT_TOKEN` | Token from BotFather | ✅ |
| `WEBHOOK_URL` | `https://your-app.onrender.com` | ✅ |
| `ADMIN_ID` | Your Telegram numeric ID | ⭐ Recommended |
| `INSTAGRAM_COOKIES` | Path to cookies.txt (for private content) | ❌ Optional |

> 💡 Get your Telegram ID from [@userinfobot](https://t.me/userinfobot)

### ***Step 5 — Deploy & Done!***

Click **Manual Deploy → Deploy latest commit**.  
The bot registers its webhook automatically on startup. ✅

---

## ***💻 Local Development***

```bash
# 1. Clone the repo
git clone https://github.com/M41NUL/all-media-downloader.git
cd all-media-downloader

# 2. Install dependencies + auto-download yt-dlp
npm install

# 3. Setup environment
cp .env.example .env
# Fill in BOT_TOKEN, WEBHOOK_URL, ADMIN_ID in .env

# 4. Expose localhost with ngrok (for webhook)
npx ngrok http 3000
# Set WEBHOOK_URL to the https ngrok URL in .env

# 5. Run the bot
npm start

# Or with auto-reload
npm run dev
```

---

## ***🤖 Bot Commands***

| Command | Description | Access |
|:--|:--|:--|
| `/start` | Show welcome screen & main menu | Everyone |
| `/admin` | Open admin panel | Admin only |

---

## ***🎛️ How to Use***

### ***🔍 Auto Detect Mode***
```
1. Tap "🎬 Auto Detect Mode" → Press "✅ ON"
2. Send any supported video URL
3. Bot auto-detects platform → downloads → sends video
```

### ***🎯 Manual Mode***
```
1. Tap "🎯 Manual Mode"
2. Select: TikTok | Instagram | Facebook
3. Send the video URL
4. Receive your video ✅
```

### ***📊 Live Progress***
```
🔄 Checking link...
📡 Extracting video information...

⬇️ Downloading Video...
[████████░░░░░░░░] 55%
🚀 Speed: 2.3 MB/s

📤 Sending Video...
[████████████░░░░] 75%
```

---

## ***⚠️ Notes & Limitations***

> - **Public content only** — private posts require Instagram cookies
> - **Max file size: 50 MB** — Telegram bot upload limit
> - **Render free plan** spins down after 15 min inactivity — use [UptimeRobot](https://uptimerobot.com) to keep it alive
> - **yt-dlp** is updated regularly; run `yt-dlp -U` to update the binary

---

## ***🐛 Reporting Issues***

Found a bug? Have a suggestion?

[![Open Issue](https://img.shields.io/badge/🐛_Report_Bug-red?style=for-the-badge)](https://github.com/M41NUL/all-media-downloader/issues/new?template=bug_report.md&labels=bug)
[![Feature Request](https://img.shields.io/badge/💡_Request_Feature-blueviolet?style=for-the-badge)](https://github.com/M41NUL/all-media-downloader/issues/new?template=feature_request.md&labels=enhancement)

**Before opening an issue, please:**
- Check [existing issues](https://github.com/M41NUL/all-media-downloader/issues)
- Make sure the video link is **public**
- Include the **error message** and **platform** (TikTok/Instagram/Facebook)

---

## ***🤝 Contributing***

Contributions are welcome! Here's how:

```bash
# 1. Fork the repo (top-right button ↗)
# 2. Create your feature branch
git checkout -b feature/AmazingFeature

# 3. Commit your changes
git commit -m "Add AmazingFeature"

# 4. Push to your fork
git push origin feature/AmazingFeature

# 5. Open a Pull Request
```

[![Fork Repo](https://img.shields.io/badge/🍴_Fork_This_Repo-orange?style=for-the-badge)](https://github.com/M41NUL/all-media-downloader/fork)
[![Star Repo](https://img.shields.io/badge/⭐_Star_This_Repo-FFD700?style=for-the-badge&logoColor=black)](https://github.com/M41NUL/all-media-downloader/stargazers)

---

## ***👨‍💻 Developer & Credits***

<div align="center">

<img src="https://github.com/M41NUL.png" width="100" style="border-radius:50%"/>

### ***Md. Mainul Islam***
#### ***MAINUL - X***

*Full-Stack Developer & Bot Creator*

<br/>

[![Telegram](https://img.shields.io/badge/Telegram-@mdmainulislaminfo-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/mdmainulislaminfo)
[![GitHub](https://img.shields.io/badge/GitHub-M41NUL-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/M41NUL)
[![YouTube](https://img.shields.io/badge/YouTube-mdmainulislaminfo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@mdmainulislaminfo)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-+8801308850528-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/8801308850528)

<br/>

[![Channel](https://img.shields.io/badge/📢_Channel-mainul__x__official-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/mainul_x_official)
[![Group](https://img.shields.io/badge/👥_Group-mainul__x__official__gc-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/mainul_x_official_gc)

<br/>

📧 **Email:** [githubmainul@gmail.com](mailto:githubmainul@gmail.com) • [devmainulislam@gmail.com](mailto:devmainulislam@gmail.com)

</div>

---

## ***📜 License***

<div align="center">

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License — © 2026 Md. Mainul Islam (MAINUL-X)
Free to use, modify, and distribute with attribution.
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

<div align="center">

### ***⭐ If this project helped you, please give it a star!***

[![Star](https://img.shields.io/github/stars/M41NUL/all-media-downloader?style=social)](https://github.com/M41NUL/all-media-downloader/stargazers)
[![Fork](https://img.shields.io/github/forks/M41NUL/all-media-downloader?style=social)](https://github.com/M41NUL/all-media-downloader/fork)
[![Watch](https://img.shields.io/github/watchers/M41NUL/all-media-downloader?style=social)](https://github.com/M41NUL/all-media-downloader/watchers)

<br/>

***Made with by [Md. Mainul Islam](https://github.com/M41NUL)***

*© 2026 MAINUL - X · MIT License*

</div>
