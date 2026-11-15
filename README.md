# ⚡ All-in-One Discord Bot & Modern Web Dashboard
### Production-Ready Discord.js v14 + Express.js + Tailwind CSS System for Hostinger Node.js Hosting

A complete, feature-rich, Carl-bot & BotGhost inspired Discord bot paired with a responsive dark-mode web dashboard. Designed specifically to deploy seamlessly on **Hostinger Node.js Web App hosting** (Node 20 / 22 LTS).

---

## 📁 Monorepo Folder Structure

```text
discord-bot-dashboard/
├── index.js                     # Unified orchestrator (runs Bot + Dashboard concurrently)
├── package.json                 # Scripts, dependencies & engine specifications
├── .env.example                 # Environment variables template
├── .gitignore                   # Ignored files, credentials, and data stores
├── README.md                    # Deployment manual and documentation
│
├── /bot                         # Discord.js v14 Bot Engine
│   ├── index.js                 # Bot entrypoint & gateway client
│   ├── deploy-commands.js       # Global slash command registration script
│   ├── handlers/
│   │   ├── commandHandler.js    # Dynamic slash command loader
│   │   ├── eventHandler.js      # Dynamic event listener loader
│   │   └── componentHandler.js  # Persistent UI component registry (Buttons, Modals, Menus)
│   ├── commands/
│   │   ├── moderation/          # /ban, /unban, /kick, /timeout, /warn, /purge, /slowmode, /lock
│   │   ├── general/             # /help, /ping, /ask (Gemini AI), /poll, /remindme
│   │   ├── leveling/            # /rank (@napi-rs/canvas), /leaderboard
│   │   ├── economy/             # /balance, /daily, /work, /pay, /shop, /coinflip, /slots, /blackjack, /rps
│   │   ├── tickets/             # /ticket-panel (multi-category interactive panels)
│   │   └── community/           # /suggest, /giveaway, /set-birthday, /setup-verification
│   ├── events/
│   │   ├── ready.js             # Presence, voice XP routine, stat channels updater
│   │   ├── interactionCreate.js # Slash commands & UI component router
│   │   ├── messageCreate.js     # AutoMod filter, text XP, counting validator, sticky messages
│   │   ├── messageUpdate.js     # Before/after diff audit logging
│   │   ├── messageDelete.js     # Deleted message audit logging
│   │   ├── messageDeleteBulk.js # Bulk purge audit logging
│   │   ├── guildMemberAdd.js    # Autoroles, sticky roles restoration, welcome card
│   │   ├── guildMemberRemove.js # Sticky roles saving, farewell messages
│   │   ├── guildMemberUpdate.js # Role & nickname change audit logging
│   │   ├── voiceStateUpdate.js  # Join-to-Create voice channels, voice-linked roles
│   │   └── messageReactionAdd.js# Starboard auto-pinning engine
│   └── utils/
│       ├── autoModChecker.js    # AutoMod rule validator & punishment dispatcher
│       ├── canvasRankCard.js    # Fast canvas rank card generator (@napi-rs/canvas)
│       ├── tempVoiceManager.js  # Personal voice channel generator & auto-cleaner
│       └── transcriptGenerator.js# Standalone HTML transcript exporter
│
├── /dashboard                   # Express.js + EJS + Tailwind CSS Web Dashboard
│   ├── server.js                # Hostinger Web App entry file
│   ├── middleware/
│   │   ├── auth.js              # Discord OAuth2 session validator & guild permissions
│   │   └── botClient.js         # Discord REST / in-process bot communication bridge
│   ├── routes/
│   │   ├── index.js             # Landing page, public leaderboard, HTML transcript viewer
│   │   ├── auth.js              # /auth/discord OAuth2 login, callback, logout
│   │   ├── servers.js           # Server selector grid (/dashboard)
│   │   ├── manage.js            # Server management subpages (/dashboard/:guildId/...)
│   │   └── api.js               # REST API endpoints for live saves & Discord publishing
│   ├── public/
│   │   ├── css/custom.css       # Discord dark theme (#0B0E14), glassmorphism, animations
│   │   └── js/
│   │       ├── main.js          # Toast notifications & AJAX form handlers
│   │       ├── live-preview.js  # Side-by-side Discord embed & button role previewer
│   │       └── charts.js        # 7-day server activity analytics (Chart.js)
│   └── views/
│       ├── partials/            # head, navbar, sidebar, footer
│       ├── landing.ejs          # Hero landing page with live server stats
│       ├── servers.ejs          # Server selector grid (Manage vs Invite)
│       ├── overview.ejs         # Server overview & live Chart.js activity
│       ├── general.ejs          # General settings, prefix, language & module toggles
│       ├── automod.ejs          # Auto-Mod rules, banned words & escalation thresholds
│       ├── reaction-roles.ejs   # Reaction & button role builder with live preview
│       ├── embeds.ejs           # Side-by-side interactive embed builder & publisher
│       ├── welcomer.ejs         # Welcomer & farewell designer with variable helpers
│       ├── custom-commands.ejs  # Custom trigger/response command manager
│       ├── leveling.ejs         # Leveling, XP rates, level roles & server shop manager
│       ├── tickets.ejs          # Ticket system settings & saved transcript list
│       ├── transcript.ejs       # Full HTML viewer for saved ticket transcripts
│       ├── public-leaderboard.ejs# Public shareable server leaderboard
│       └── error.ejs            # Error page
│
└── /shared                      # Unified Database & Multi-Adapter Layer
    ├── index.js                 # Re-exports db, logger, and helpers
    ├── database.js              # Multi-adapter driver (MongoDB, PostgreSQL, or Local JSON fallback)
    └── utils/
        ├── logger.js            # Timestamped colored console logger
        └── helpers.js           # Duration parsers, level math, string truncation, diffs
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `20.x` or `22.x` LTS
- **Discord Developer Application** (https://discord.com/developers/applications)

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `ADMIN_USERNAME` | Master Dashboard Admin Username (e.g. `admin`) |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash generated via `npm run generate-hash` (Recommended for Hostinger) |
| `ADMIN_PASSWORD` | Fallback plaintext password (auto-hashed at boot if hash not set) |
| `PUBLIC_LEADERBOARD` | `false` (default: locked behind login) or `true` (publicly accessible) |
| `DISCORD_TOKEN` | Discord Bot Token from Developer Portal -> Bot -> Reset Token |
| `CLIENT_ID` | Application Client ID from General Information |
| `CLIENT_SECRET` | Client Secret from OAuth2 -> General |
| `CALLBACK_URL` | `http://localhost:3000/auth/discord/callback` (or your Hostinger URL) |
| `SESSION_SECRET` | Strong random string for session signature |
| `DATABASE_URL` | MongoDB, Supabase/PostgreSQL connection string, or leave empty for local JSON fallback |
| `GEMINI_API_KEY` | Google Gemini API key from https://aistudio.google.com/ |
| `PORT` | `3000` (Hostinger automatically provides PORT) |
| `APP_MODE` | `all` (runs both bot & dashboard in single process), `dashboard`, or `bot` |

### 3. Generate Secure Master Admin Password Hash
Generate a 12-round bcrypt password hash to set as `ADMIN_PASSWORD_HASH`:
```bash
npm run generate-hash
# or: npm run generate-hash "MySuperSecretPassword123!"
```

### 4. Deploy Slash Commands to Discord
Register all 28+ slash commands with Discord globally:
```bash
npm run deploy:commands
```

### 5. Run Locally
```bash
npm start
```
Navigate to [http://localhost:3000](http://localhost:3000). You will be presented with the **Master Admin Login Gate** (`/login`).

---

## 🛠️ Configuring Discord Developer Portal

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select your Application (or create a new one).
3. **Privileged Gateway Intents (Crucial):**
   - Click **Bot** on the left menu.
   - Scroll down to **Privileged Gateway Intents**.
   - Enable **PRESENCE INTENT**, **SERVER MEMBERS INTENT**, and **MESSAGE CONTENT INTENT**.
   - Click **Save Changes**.
4. **OAuth2 Redirect URI:**
   - Click **OAuth2** on the left menu.
   - Under **Redirects**, click **Add Redirect**.
   - Add your local testing URL: `http://localhost:3000/auth/discord/callback`
   - Add your production Hostinger domain: `https://yourdomain.com/auth/discord/callback`
   - Click **Save Changes**.
5. **Bot Invite URL:**
   - Click **OAuth2** -> **URL Generator**.
   - Under **Scopes**, select `bot` and `applications.commands`.
   - Under **Bot Permissions**, select `Administrator` (or appropriate moderation permissions).
   - Copy the generated URL to invite your bot to your Discord server!

---

## 🌐 Deploying on Hostinger (Node.js Web App)

Hostinger provides managed Node.js Web App hosting on hPanel. Follow these steps:

### Step 1: Create a Node.js Web App in Hostinger hPanel
1. Log into your **Hostinger hPanel**.
2. Navigate to **Websites** -> **Add or Manage Websites**.
3. Choose **Node.js Web App** (or go to **Advanced** -> **Node.js**).
4. Configure the environment:
   - **Node.js Version**: Select **Node 20.x** or **Node 22.x LTS**.
   - **Application Root**: `/` (or your repository subfolder).
   - **Application URL**: `https://yourdomain.com`
   - **Application Startup File (Entrypoint)**:
     - For All-in-One deployment (Bot + Dashboard simultaneously): `index.js`
     - For Dashboard only: `dashboard/server.js`

### Step 2: Upload Project Files
Deploy your repository using **Git Integration** in hPanel:
1. Under **Advanced** -> **Git**, connect your GitHub/GitLab repository.
2. Select the `main` branch.
3. Click **Deploy**.
*(Alternatively, zip the project files excluding `node_modules` and upload via hPanel File Manager).*

### Step 3: Install Dependencies
Open the **SSH / Terminal** in Hostinger hPanel and run:
```bash
npm install
npm run deploy:commands
```

### Step 4: Configure Environment Variables in hPanel
Under **Node.js App Settings** -> **Environment Variables**, add:
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD_HASH`: *(Paste the bcrypt hash generated from `npm run generate-hash`)*
- `PUBLIC_LEADERBOARD`: `false`
- `DISCORD_TOKEN`: `your_discord_bot_token`
- `CLIENT_ID`: `your_client_id`
- `CLIENT_SECRET`: `your_client_secret`
- `CALLBACK_URL`: `https://yourdomain.com/auth/discord/callback`
- `SESSION_SECRET`: `your_random_secret_here`
- `DATABASE_URL`: Your MongoDB / PostgreSQL URL (or leave blank to use the built-in local store)
- `GEMINI_API_KEY`: `your_google_gemini_api_key`
- `APP_MODE`: `all`
- `NODE_ENV`: `production`

### Step 5: Restart Application
Click **Restart** in the Node.js Web App panel. Your dashboard is now live at `https://yourdomain.com` and the bot is online 24/7!

---

## 🔄 Running the Bot 24/7

### Option A: All-in-One Container (Recommended for Hostinger Web App)
Keep `APP_MODE=all` in `.env` (or hPanel environment variables). The root `index.js` automatically spawns both the Discord Bot worker and the Express Web Dashboard inside one Node.js process:
- Zero extra hosting cost.
- Shared memory IPC for ultra-fast Discord API responses.
- Automatically managed and restarted by Hostinger's process manager.

### Option B: Dedicated Worker Process (VPS / PM2)
If you run on a Hostinger VPS or prefer separated background worker processes:
```bash
# Terminal 1: Dashboard
pm2 start dashboard/server.js --name "discord-dashboard"

# Terminal 2: Bot Worker
pm2 start bot/index.js --name "discord-bot"

# Save PM2 process list to persist on reboot
pm2 save
pm2 startup
```
Because both processes connect to the same `DATABASE_URL`, changes made in the dashboard update the bot worker in real-time.

---

## 🗄️ Shared Database Layer Details

The unified data layer in `/shared/database.js` provides automatic multi-database abstraction:

1. **MongoDB**: Set `DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname`
2. **PostgreSQL / Supabase**: Set `DATABASE_URL=postgresql://postgres:pass@db.supabase.co:5432/postgres` (automatically creates high-performance JSONB collection tables with indexation).
3. **Local JSON Fallback**: Leave `DATABASE_URL` empty or set to `"local"`. The system uses a fast, transactional, atomic JSON file store in `/shared/data/store.json`. **Requires zero database installation!**
