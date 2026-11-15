# OmniBots
### Open-Source, Self-Hostable Multi-Bot Discord Management Panel and Bot Engine
Built with Node.js 20/22 LTS, discord.js v14, Express.js, and Tailwind CSS.

OmniBots is an enterprise-grade, zero-configuration Discord bot engine and responsive dark-mode web dashboard. Designed for one-click Git deployment on Hostinger Node.js Web App hosting, VPS instances, Docker containers, or local development environments.

---

## Key Features

- **Zero-Env First-Run Wizard**: Deploy directly without configuring environment variables upfront. On initial boot, OmniBots generates local cryptographic keys and launches a web setup wizard at `/setup` to create the master administrator account.
- **Multi-Bot Fleet Hub**: Connect, monitor, start, stop, restart, and synchronize multiple Discord bots concurrently from a single unified panel.
- **Unified Dual-Command Engine**: Every command runs as both a Slash Command (`/command`) and a Chat Prefix Command (`!command` or `@Bot command`) through an abstracted execution context.
- **Privileged Gateway Intents Safeguard**: Gracefully handles missing Privileged Gateway Intents (Message Content, Server Members, Presence) with actionable dashboard alerts and no process crashes.
- **Granular Command Customization**: Configure server prefixes, secondary prefixes, aliases, channel whitelists/blacklists, role restrictions, custom cooldowns, and trigger message auto-deletion.
- **Live Embed Designer**: Interactive Discord embed builder with real-time visual client rendering and variable replacement pills (`{user}`, `{server}`, `{members}`).
- **Comprehensive Functional Modules**:
  1. **Moderation Engine**: `/ban`, `/unban`, `/tempban`, `/softban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nuke`.
  2. **Auto-Moderation**: Anti-invites, anti-links, anti-spam, mention/emoji thresholds, banned word filtering, auto-escalation rules, and sticky roles.
  3. **Granular Logging**: Event logging for message edits/deletions, member joins/leaves, role modifications, and voice state transitions.
  4. **Invite Tracker**: Attribution tracking, fake and leave deductions, milestone role rewards, and bonus invite adjustments.
  5. **Reaction and Button Roles**: Multi-mode role panels (Single, Multiple, Toggle) dispatched to Discord channels.
  6. **Support Tickets and Modmail**: Multi-category ticket panels, modal prompts, automated HTML transcript generation, and web transcript viewer.
  7. **Leveling and Rank Cards**: Server activity XP calculations, Canvas rank card rendering (@napi-rs/canvas), role rewards, and XP management commands.
  8. **Economy and Games**: Wallet and bank balances, daily and weekly allowances, transfers, work, robbery, coinflip, blackjack, slots, roulette, and server shop.
  9. **Temporary Voice**: Join-to-Create voice channels with automatic deletion upon vacancy.
  10. **Community Engagement**: Suggestions, giveaways, starboard, AFK status tracking, message snipe, counting, and birthdays.
  11. **Automation and AI**: Google Gemini AI assistant commands, scheduled announcements, RSS feeds, and autoresponders.
  12. **Verification and Legal Compliance**: Verification-ready public `/privacy` and `/terms` documents, administrative document editor, and GDPR data deletion commands.

---

## Repository Structure

```text
omnibots/
├── index.js                     # Process orchestrator (starts BotManager and Dashboard)
├── package.json                 # Project configuration and dependency manifests
├── .env.example                 # Optional environment variable template
├── .gitignore                   # Ignores /data/, node_modules, and session stores
│
├── /bot                         # Discord.js v14 Bot Engine
│   ├── index.js                 # Bot worker entrypoint
│   ├── BotManager.js            # Multi-bot fleet manager, REST sync, and intent error handling
│   ├── deploy-commands.js       # Manual REST slash command deployment utility
│   ├── structures/
│   │   └── CommandContext.js    # Unified Slash and Prefix abstraction layer
│   ├── handlers/
│   │   ├── commandHandler.js    # Dynamic command registry loader
│   │   ├── commandRouter.js     # Command validation, cooldown, and routing pipeline
│   │   ├── eventHandler.js      # Gateway event listener loader
│   │   └── componentHandler.js  # Interactive UI component registry (Buttons, Modals)
│   ├── commands/                # 12 module command subdirectories
│   ├── events/                  # Gateway event handlers
│   └── utils/                   # Rank card generator, auto-mod checker, temp voice
│
├── /dashboard                   # Express.js Web Dashboard and REST API
│   ├── server.js                # Express web server entrypoint
│   ├── middleware/
│   │   ├── auth.js              # Master admin authentication and route protection
│   │   ├── sessionStore.js      # Persistent database session store
│   │   └── botClient.js         # Multi-client IPC and Discord REST bridge
│   ├── routes/
│   │   ├── auth.js              # /setup, /login, /logout, /auth/discord
│   │   ├── index.js             # Public routes, legal documents, health check
│   │   ├── servers.js           # Server selector grid
│   │   ├── manage.js            # Server management and Multi-Bot Hub routes
│   │   └── api.js               # REST API endpoints for configuration updates
│   ├── views/                   # EJS templates styled with Tailwind CSS
│   └── public/                  # Static assets (logo.svg, favicon.svg, CSS, JS)
│
└── /shared                      # Shared Database and Security Layer
    ├── config.js                # Zero-Env engine and AES-256-GCM token encryption
    ├── database.js              # Multi-adapter database layer (MongoDB, PostgreSQL, Local JSON)
    └── utils/                   # Logger, legal document templates, and helper utilities
```

---

## Deployment Guide for Hostinger

### Step 1: Connect GitHub Repository
1. Log in to the Hostinger Control Panel (hPanel).
2. Navigate to Websites > Add Website (or select an existing site).
3. Select Node.js Web App.
4. Under Git Deployment, configure:
   - Repository: `https://github.com/PantherYTac/OmniBots`
   - Branch: `main`

### Step 2: Configure Application Settings
- **Node.js Version**: Select `20.x` or `22.x` LTS.
- **Application Root**: `/`
- **Application Startup File**: `index.js`
- **Environment Variables**: Leave blank. OmniBots operates with zero required deployment variables.

### Step 3: Run the First-Run Setup Wizard
1. Open the application domain in a web browser.
2. The application automatically redirects to the Setup Wizard at `/setup`.
3. Enter the master administrator username and password (hashed with bcryptjs, 12 rounds).
4. Upon submission, the setup route permanently locks, and the session opens to the Multi-Bot Hub.

### Step 4: Connect Discord Bots
1. In the Multi-Bot Hub, click Add New Discord Bot.
2. Enter the bot token from the Discord Developer Portal.
3. OmniBots encrypts the token with AES-256-GCM, connects to Discord, and registers global slash commands.
4. Enable the three Privileged Gateway Intents in the Discord Developer Portal:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/PantherYTac/OmniBots.git
cd OmniBots

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open dashboard in browser
# http://localhost:3000
```

---

## Security Architecture

- **Cryptographic Key Generation**: Session secrets and AES-256 encryption keys are generated using `crypto.randomBytes(32)` and isolated in `/data/config.json`.
- **Encrypted Token Storage**: Bot tokens are encrypted at rest with AES-256-GCM using unique initialization vectors and authentication tags.
- **Brute-Force Rate Limiting**: Strict IP-based rate limiting on administrative login endpoints via `express-rate-limit`.
- **Session Fixation Prevention**: Session IDs regenerate upon successful authentication via `req.session.regenerate`.
- **Constant-Time Verification**: Bcrypt password comparison mitigates timing attacks, and input lengths are capped at 72 bytes.

---

## License and Compliance

Distributed under the MIT License. Built in full compliance with the Discord Developer Terms of Service and Application Verification Guidelines. Includes default Discord-tailored Privacy Policy and Terms of Service templates.
