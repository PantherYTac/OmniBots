# 🚀 OmniBots
### Open-Source, Self-Hostable All-in-One Multi-Bot Discord Management Panel & Bot Engine
Built with **Node.js 20/22 LTS**, **discord.js v14**, **Express.js**, and **Tailwind CSS**.

OmniBots is an enterprise-grade, zero-configuration Discord bot engine and modern dark-mode web dashboard inspired by Carl-bot and BotGhost. It is engineered specifically for effortless one-click Git deployment on **Hostinger Node.js Web App hosting**, VPS, Docker, or any local workstation.

---

## ✨ Key Features & Capabilities

- **Zero-Env First-Run Wizard**: Deploy directly to Hostinger without entering any environment variables upfront. On first boot, OmniBots auto-generates AES-256-GCM encryption keys and routes you to the secure `/setup` wizard to create your Master Administrator account.
- **Multi-Bot Fleet Hub**: Connect, manage, start, stop, restart, and monitor multiple Discord bots concurrently from a single unified panel.
- **Unified Dual-Command Engine**: Every command across all 12 modules runs seamlessly as BOTH a **Slash Command (`/command`)** and a **Chat Prefix Command (`!command` or `@Bot command`)** via an abstracted `CommandContext`.
- **Privileged Gateway Intents Safeguard**: Automatically catches missing Privileged Intents (`Message Content`, `Server Members`, `Presence`) and displays friendly actionable guidance in the dashboard without crashing.
- **Deep Command Customization**: Configure server prefixes, secondary prefixes, custom command aliases, channel whitelists/blacklists, role restrictions, per-command cooldowns, and trigger message auto-deletion.
- **Universal Live Embed Builder**: Interactive Discord embed designer with real-time visual client preview and variable pills (`{user}`, `{server}`, `{members}`).
- **12 Comprehensive Modules**:
  1. **Moderation Engine**: `/ban`, `/unban`, `/tempban`, `/softban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nuke`.
  2. **Auto-Moderation**: Anti-invites, anti-links, anti-spam, mention/emoji limits, banned word filter, auto-escalation rules, and sticky roles.
  3. **Granular Logging**: Detailed channel logs for deleted/edited messages, member joins/leaves, role changes, and voice state transitions.
  4. **Invite Tracker**: Real-time join attribution, fake/leave deduction, invite milestone role rewards, and bonus invite management.
  5. **Reaction & Button Roles**: Interactive multi-mode role panels (Single, Multiple, Toggle) dispatched to Discord channels.
  6. **Support Tickets & Modmail**: Multi-category ticket panels, modal reason prompts, automated HTML transcript generation, and web viewer.
  7. **Leveling & Rank Cards**: Dynamic XP engine, high-speed canvas rank cards (`@napi-rs/canvas`), level role rewards, and `/set-xp`/`/reset-xp`.
  8. **Economy & Casino Games**: `/balance`, `/daily`, `/weekly`, `/pay`, `/work`, `/rob`, `/blackjack`, `/slots`, `/coinflip`, `/roulette`, `/rps`, and server shop.
  9. **Temporary Voice**: Join-to-Create voice channels with automatic cleanup on vacancy.
  10. **Community & Engagement**: `/suggest`, `/giveaway`, `/starboard`, `/afk`, `/snipe`, `/counting`, `/birthday`, and confession box.
  11. **AI & Automation**: Google Gemini AI `/ask` assistant, scheduled cron announcements, RSS feeds, and autoresponders.
  12. **Discord Verification & Legal**: Built-in public `/privacy` and `/terms` pages, admin legal editor, and `/delete-my-data` GDPR compliance.

---

## 📁 Repository Structure

```text
omnibots/
├── index.js                     # Unified orchestrator (starts BotManager + Dashboard)
├── package.json                 # Project configuration & npm scripts
├── .env.example                 # Optional environment overrides (Zero required!)
├── .gitignore                   # Ignores /data/, node_modules, and session stores
│
├── /bot                         # Discord.js v14 Bot Engine
│   ├── index.js                 # Bot entrypoint & BotManager initialization
│   ├── BotManager.js            # Multi-bot fleet manager, REST slash sync, intent traps
│   ├── deploy-commands.js       # Manual REST slash command sync utility
│   ├── structures/
│   │   └── CommandContext.js    # Unified Slash + Prefix abstraction layer
│   ├── handlers/
│   │   ├── commandHandler.js    # Dynamic command registry loader
│   │   ├── commandRouter.js     # Dual-command dispatcher (permissions, cooldowns, aliases)
│   │   ├── eventHandler.js      # Gateway event listener loader
│   │   └── componentHandler.js  # Interactive UI button & modal registry
│   ├── commands/                # 12 functional module subdirectories
│   ├── events/                  # Discord gateway event handlers
│   └── utils/                   # Rank card generator, auto-mod checker, temp voice
│
├── /dashboard                   # Express.js Web Dashboard & API
│   ├── server.js                # Express entrypoint (Hostinger Web App entry)
│   ├── middleware/
│   │   ├── auth.js              # Master Admin session gate & First-Run Wizard router
│   │   ├── sessionStore.js      # Persistent database session store
│   │   └── botClient.js         # Multi-client IPC and Discord REST bridge
│   ├── routes/
│   │   ├── auth.js              # /setup, /login, /logout, /auth/discord
│   │   ├── index.js             # Navigation, legal routes (/privacy, /terms), /health
│   │   ├── servers.js           # Server selector grid (/dashboard)
│   │   ├── manage.js            # Module configuration subpages & /dashboard/bots
│   │   └── api.js               # REST API endpoints for live saves & bot controls
│   ├── views/                   # Dark-mode EJS templates styled with Tailwind CSS
│   └── public/                  # Static assets (logo.svg, favicon.svg, CSS, JS)
│
└── /shared                      # Database & Configuration Engine
    ├── config.js                # Zero-Env engine & AES-256-GCM token encryption
    ├── database.js              # Multi-adapter storage (MongoDB, PostgreSQL, or Local JSON)
    └── utils/                   # Timestamped logger, legal templates, math helpers
```

---

## 🚀 One-Click Deployment on Hostinger

### Step 1: Connect Your GitHub Repository
1. Log in to your **Hostinger Control Panel (hPanel)**.
2. Navigate to **Websites** > **Add Website** or manage your existing domain.
3. Choose **Node.js Web App**.
4. In the Git Deployment section:
   - Repository: `https://github.com/PantherYTac/OmniBots`
   - Branch: `main`

### Step 2: Configure Application Settings
- **Node.js Version**: Select `20.x` or `22.x` LTS.
- **Application Root**: `/` (Leave as repository root).
- **Application Startup File**: `index.js` (or `dashboard/server.js` if running web only).
- **Environment Variables**: **Leave Completely Blank!** OmniBots is 100% Zero-Env compatible. You will not be prompted to enter variables.

### Step 3: Run First-Run Setup Wizard
1. Once deployed, open your website domain in any browser (e.g., `https://yourdomain.com`).
2. You will be automatically redirected to the **First-Run Setup Wizard (`/setup`)**.
3. Choose your master administrator username and secure password (hashed with `bcryptjs`, 12 salt rounds).
4. Upon submission, the setup route permanently locks, and you are logged into your **Multi-Bot Fleet Hub**!

### Step 4: Add Your Discord Bot Token
1. From the **Multi-Bot Hub**, click **Add New Discord Bot**.
2. Paste your bot token from the [Discord Developer Portal](https://discord.com/developers/applications).
3. OmniBots will encrypt your token with AES-256-GCM, connect the bot to Discord, and auto-register all universal slash commands (`/`).
4. Make sure to toggle ON the 3 Privileged Gateway Intents under your bot application settings:
   - **Message Content Intent**
   - **Server Members Intent**
   - **Presence Intent**

---

## 💻 Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/PantherYTac/OmniBots.git
cd OmniBots

# 2. Install dependencies
npm install

# 3. Start development server with live reload
npm run dev

# 4. Open dashboard in browser
open http://localhost:3000
```

---

## 🔒 Security Architecture

- **Zero-Env Auto-Key Generation**: Session secrets and AES-256 encryption keys are generated using cryptographically secure random bytes (`crypto.randomBytes(32)`) and isolated in `/data/config.json` (ignored in `.git`).
- **Encrypted Token Storage**: Discord bot tokens are encrypted at rest using AES-256-GCM with authentication tags.
- **Brute-Force Rate Limiting**: `express-rate-limit` enforces strict limits on login attempts per IP.
- **Session Fixation Mitigation**: Express session IDs are regenerated upon authentication (`req.session.regenerate`).
- **Constant-Time Bcrypt Verification**: Bcrypt comparison prevents timing attacks, with input length restricted to <= 72 bytes.

---

## 📜 License & Compliance

Distributed under the **MIT License**. Compliant with Discord Developer Terms of Service and Verification Requirements. Includes Discord-tailored Privacy Policy and Terms of Service templates.
