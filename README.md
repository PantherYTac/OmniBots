# OmniBots
### Enterprise Multi-Bot Discord Engine and Management Dashboard
Built with Node.js 20/22 LTS, discord.js v14, Express.js, and Tailwind CSS.

OmniBots is an open-source, self-hostable Discord bot orchestration platform and responsive dark-mode web management panel. It allows server administrators and bot developers to operate, configure, and monitor multiple Discord bots concurrently from a single unified web dashboard.

---

## Table of Contents

1. [Project Overview and Core Features](#project-overview-and-core-features)
2. [Discord Developer Portal Setup (Required for All Hosts)](#discord-developer-portal-setup-required-for-all-hosts)
3. [Deployment Guides](#deployment-guides)
   - [Option A: Hostinger Managed Node.js Web App and VPS](#option-a-hostinger-managed-nodejs-web-app-and-vps)
   - [Option B: Linux VPS (Ubuntu, Debian, Oracle Cloud, DigitalOcean)](#option-b-linux-vps-ubuntu-debian-oracle-cloud-digitalocean)
   - [Option C: Pterodactyl Panel Game/Bot Hosts](#option-c-pterodactyl-panel-gamebot-hosts)
   - [Option D: Cloud PaaS (Render, Railway, Koyeb)](#option-d-cloud-paas-render-railway-koyeb)
   - [Option E: Local Workstation (Windows, macOS, Linux)](#option-e-local-workstation-windows-macos-linux)
4. [First-Time Onboarding and Master Setup](#first-time-onboarding-and-master-setup)
5. [Architecture and Security Design](#architecture-and-security-design)
6. [Troubleshooting and Common Questions](#troubleshooting-and-common-questions)
7. [License and Compliance](#license-and-compliance)

---

## Project Overview and Core Features

- **Zero-Env First-Run Wizard**: Deploy without entering any environment variables upfront. On initial boot, OmniBots auto-generates AES-256-GCM encryption keys and routes you to the setup wizard at `/setup` to create the master administrator account.
- **Multi-Bot Fleet Hub**: Connect, monitor, start, stop, restart, and synchronize multiple Discord bots concurrently from a single unified panel.
- **Unified Dual-Command Engine**: Every command across all modules functions seamlessly as both a Slash Command (`/command`) and a Chat Prefix Command (`!command` or `@Bot command`) via an abstracted `CommandContext`.
- **Privileged Gateway Intents Safeguard**: Automatically traps missing privileged intents (`Message Content`, `Server Members`, `Presence`) and displays friendly actionable guidance in the dashboard without crashing the process.
- **Deep Command Customization**: Configure server prefixes, secondary prefixes, custom command aliases, channel whitelists/blacklists, role restrictions, per-command cooldowns, and trigger message auto-deletion.
- **Universal Live Embed Builder**: Interactive Discord embed designer with real-time visual client preview and variable pills (`{user}`, `{server}`, `{members}`).
- **Complete Module Suite**:
  - **Moderation Engine**: `/ban`, `/unban`, `/tempban`, `/softban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nuke`.
  - **Auto-Moderation**: Anti-invites, anti-links, anti-spam, mention/emoji limits, banned word filter, auto-escalation rules, and sticky roles.
  - **Granular Logging**: Detailed channel logs for deleted/edited messages, member joins/leaves, role changes, and voice state transitions.
  - **Invite Tracker**: Real-time join attribution, fake/leave deduction, invite milestone role rewards, and bonus invite management.
  - **Reaction and Button Roles**: Interactive multi-mode role panels (Single, Multiple, Toggle) dispatched to Discord channels.
  - **Support Tickets and Modmail**: Multi-category ticket panels, modal reason prompts, automated HTML transcript generation, and web viewer.
  - **Leveling and Rank Cards**: Dynamic XP engine, high-speed Canvas rank cards, zero-compile SVG fallback, level role rewards, and `/set-xp`/`/reset-xp`.
  - **Economy and Casino Games**: `/balance`, `/daily`, `/weekly`, `/pay`, `/work`, `/rob`, `/blackjack`, `/slots`, `/coinflip`, `/roulette`, `/rps`, and server shop.
  - **Temporary Voice**: Join-to-Create voice channels with automatic cleanup on vacancy.
  - **Community Engagement**: `/suggest`, `/giveaway`, `/starboard`, `/afk`, `/snipe`, `/counting`, `/birthday`, and confession box.
  - **AI and Automation**: Google Gemini AI assistant commands, scheduled announcements, RSS feeds, and autoresponders.
  - **Discord Verification and Legal**: Built-in public `/privacy` and `/terms` pages, admin legal editor, and `/delete-my-data` GDPR compliance.

---

## Discord Developer Portal Setup (Required for All Hosts)

Before deploying OmniBots to any host, you must register your Discord Bot Application:

### Step 1: Create Your Discord Application
1. Navigate to the [Discord Developer Portal](https://discord.com/developers/applications) and sign in.
2. Click **New Application** in the top-right corner.
3. Give your bot a name (e.g., `OmniBots`) and agree to Discord's Developer Terms.
4. Click **Create**.

### Step 2: Copy the Bot Token
1. In the left sidebar, click **Bot**.
2. Click **Reset Token** (confirm the prompt if requested).
3. Click **Copy** to copy the token to your clipboard.
4. Keep this token safe and private. You will paste it into your OmniBots Web Dashboard after deployment.

### Step 3: Enable the 3 Privileged Gateway Intents
1. On the same **Bot** page, scroll down to the **Privileged Gateway Intents** section.
2. Toggle **ON** all three switches:
   - **Presence Intent**
   - **Server Members Intent**
   - **Message Content Intent**
3. Click **Save Changes** at the bottom.
*(Note: These three intents allow OmniBots to track member joins, welcomer cards, infractions, auto-moderation, and prefix commands).*

### Step 4: Generate Your Bot Invite Link
1. In the left sidebar, navigate to **OAuth2** > **URL Generator**.
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select **Administrator** (or choose: *Manage Roles, Manage Channels, Kick Members, Ban Members, Moderate Members, Send Messages, Embed Links, Attach Files, Read Message History, Use External Emojis, Manage Messages*).
4. Scroll to the bottom and copy the **Generated URL**.
5. Paste this URL into a browser tab and select your Discord server to invite the bot.

---

## Deployment Guides

### Option A: Hostinger Managed Node.js Web App and VPS

Hostinger provides managed Node.js web application hosting directly inside hPanel. OmniBots is specifically structured to run cleanly on Hostinger without compilation errors or environment variable prompts.

#### Method 1: Hostinger Managed Node.js Web App (hPanel)

1. **Access Node.js Management**:
   - Log into your Hostinger Control Panel (hPanel).
   - Go to **Websites** > **Manage** next to your domain.
   - In the left sidebar or search bar, navigate to **Advanced** > **Node.js** (or **Websites > Node.js Web App**).

2. **Configure Node.js Application Settings**:
   - **Node.js Version**: Select `20.x` or `22.x` LTS.
   - **Application Root**: `/` (leave as root directory).
   - **Application Startup File**: `dashboard/server.js` (or `index.js`).
   - **Environment**: Select `Production`.

3. **Connect GitHub Repository**:
   - In the Git Repository section, choose **Deploy from Git**.
   - **Repository URL**: `https://github.com/PantherYTac/OmniBots`
   - **Branch**: `main`
   - **Auto-Deploy on Push**: Optional (enable if you want automatic redeploys on new commits).

4. **Environment Variables**:
   - **Leave Completely Blank!**
   - OmniBots features a Zero-Env initialization engine. It automatically creates local session keys, port configurations, and encryption keys on first run.

5. **Deploy and Run**:
   - Click **Create** or **Deploy**.
   - Hostinger will run `npm install` and start the server.
   - Because all C++ compilation packages have pure-JS fallbacks, installation completes quickly without errors.

6. **Fix "Not Secure" / Enable SSL**:
   - In hPanel, navigate to **Security** > **SSL**.
   - Ensure a Let's Encrypt SSL certificate is installed for your domain.
   - Toggle **Force HTTPS** to **ON**.
   - OmniBots includes `app.set('trust proxy', 1);` and `cookie: { secure: 'auto' }`, ensuring cookies and sessions work smoothly across Hostinger's HTTPS reverse proxy.

7. **Important Note on 24/7 Bot Workers**:
   - On shared web hosting plans, Hostinger's proxy may place idle web containers to sleep after extended periods without HTTP traffic.
   - To keep your Discord bots connected 24/7 on shared tiers:
     - Set up a free uptime monitor (e.g., UptimeRobot, BetterStack, or Cron-Job.org) pinging your health endpoint every 5 minutes: `https://yourdomain.com/health`.
     - Or upgrade to a Hostinger VPS (detailed below) where PM2 keeps the Node.js process running continuously in memory.

#### Method 2: Hostinger VPS (Ubuntu 22.04 / 24.04)

For high-volume Discord servers requiring 24/7 uptime without container idle sleep:

```bash
# 1. Connect to your VPS via SSH
ssh root@your_server_ip

# 2. Update system and install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs git

# 3. Clone OmniBots
git clone https://github.com/PantherYTac/OmniBots.git
cd OmniBots

# 4. Install dependencies
npm install

# 5. Install PM2 process manager
sudo npm install -g pm2

# 6. Start OmniBots with PM2
pm2 start dashboard/server.js --name omnibots

# 7. Enable automatic reboot persistence
pm2 save
pm2 startup
```

---

### Option B: Linux VPS (Ubuntu, Debian, Oracle Cloud, DigitalOcean)

This guide works on any Linux server, including Ubuntu 20.04/22.04/24.04, Debian 11/12, Oracle Cloud Always Free, DigitalOcean Droplets, Linode, and Contabo.

#### Step 1: Install Node.js 20 LTS and Git
```bash
# Update package repositories
sudo apt update && sudo apt upgrade -y

# Add NodeSource Node.js 20 LTS repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
```

#### Step 2: Clone and Install OmniBots
```bash
# Clone the repository
git clone https://github.com/PantherYTac/OmniBots.git
cd OmniBots

# Install dependencies
npm install
```

#### Step 3: Run with PM2 Process Manager
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the dashboard and bot worker
pm2 start dashboard/server.js --name omnibots

# Save PM2 state and configure auto-start on system reboot
pm2 save
pm2 startup
```

#### Step 4: Configure Nginx Reverse Proxy with Free Let's Encrypt SSL
```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/omnibots
```

Paste the following configuration (replace `yourdomain.com` with your actual domain):
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and obtain SSL:
```bash
# Enable site and test configuration
sudo ln -s /etc/nginx/sites-available/omnibots /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtain free Let's Encrypt SSL certificate
sudo certbot --nginx -d yourdomain.com
```

---

### Option C: Pterodactyl Panel Game/Bot Hosts

OmniBots runs directly on game and Discord bot hosts powered by Pterodactyl Panel (such as NexCloud, HeavenCloud, VisiHost, SparkedHost, and FalixNodes).

1. **Create or Access Your Server**:
   - Create a new server in your panel using the **Node.js Egg** (Node 20 or 22).
2. **Deploy Files**:
   - **Method A (Git)**: In your server's Startup tab, set Git Repository to `https://github.com/PantherYTac/OmniBots.git` and Branch to `main`.
   - **Method B (Archive)**: Download the OmniBots repository zip from GitHub and upload/extract it into the root directory via the File Manager.
3. **Configure Startup Command**:
   - In the **Startup** tab, set the Startup File / Command to:
     ```bash
     node dashboard/server.js
     ```
   - (Or use `npm start`).
4. **Network and Ports**:
   - Ensure the server allocation port is assigned. OmniBots automatically reads `process.env.PORT` provided by Pterodactyl.
5. **Start the Server**:
   - Return to the **Console** tab and click **Start**.
   - Monitor the console until you see:
     `OmniBots Web Dashboard online and listening on 0.0.0.0:[PORT]`
   - Open your assigned server address in a browser.

---

### Option D: Cloud PaaS (Render, Railway, Koyeb)

#### Render.com
1. Create a new account on [Render](https://render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository `PantherYTac/OmniBots`.
4. Configure service details:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node dashboard/server.js`
   - **Plan**: Free or Starter.
5. Optional Persistent Disk:
   - To persist local database changes across redeploys without an external database, add a Disk mounted at `/data`.
   - Or connect a free MongoDB/PostgreSQL database by adding `DATABASE_URL` under Environment Variables.

#### Railway.app
1. Create a new project on [Railway](https://railway.app).
2. Select **Deploy from GitHub repo** and pick `PantherYTac/OmniBots`.
3. Railway automatically detects `package.json` and runs `npm install` and `npm start`.
4. Under Settings > Networking, click **Generate Domain** to get a public HTTPS address.

---

### Option E: Local Workstation (Windows, macOS, Linux)

You can run OmniBots locally on your desktop or laptop for testing and personal server management.

```bash
# 1. Clone the repository
git clone https://github.com/PantherYTac/OmniBots.git
cd OmniBots

# 2. Install dependencies
npm install

# 3. Start the application
npm start

# 4. Open in your browser
# Navigate to: http://localhost:3000
```

---

## First-Time Onboarding and Master Setup

Once your OmniBots instance is deployed and running on any host, follow these steps to initialize your panel:

### Step 1: Open the Setup Wizard
1. Open your domain or local address in any browser:
   `https://yourdomain.com/setup` (or `http://localhost:3000/setup`).
2. You will be greeted by the **First-Run Setup Wizard**.
3. Choose a **Master Admin Username** and **Master Password** (minimum 8 characters).
4. Click **Complete Setup & Launch Dashboard**.
5. Your password is encrypted using `bcryptjs` with 12 salt rounds, and the setup route permanently locks to prevent unauthorized re-registration.

### Step 2: Connect Your First Discord Bot
1. From the main dashboard, click **Multi-Bot Hub** in the navigation bar.
2. Click the **+ Add New Discord Bot** button.
3. Paste the **Bot Token** you copied from the Discord Developer Portal.
4. Optional: Give your bot a custom display name.
5. Click **Connect & Start Bot**.
6. OmniBots encrypts the token using AES-256-GCM, verifies credentials with the Discord Gateway, and launches the bot instance.

### Step 3: Register Global Slash Commands
1. In the Multi-Bot Hub card for your bot, click **Sync Slash (/)**.
2. OmniBots registers all universal application commands across all 12 modules directly with Discord's REST API.
3. Slash commands appear in your Discord servers immediately.

### Step 4: Configure Verification Legal Pages (Discord Compliant)
1. In the sidebar, navigate to **Legal & Verification**.
2. Enter your public support server invite link and contact email.
3. OmniBots generates live, public, Discord-compliant legal documents at:
   - `https://yourdomain.com/privacy`
   - `https://yourdomain.com/terms`
4. Copy these URLs into your Discord Developer Portal application settings under **Privacy Policy URL** and **Terms of Service URL** to prepare for official Discord bot verification.

---

## Architecture and Security Design

```text
                               +-------------------------------------+
                               |         User Web Browser            |
                               +-------------------------------------+
                                                  |
                                                  v HTTPS (443)
                               +-------------------------------------+
                               |   Reverse Proxy (Hostinger / Nginx) |
                               +-------------------------------------+
                                                  |
                                                  v HTTP (Port 3000)
+---------------------------------------------------------------------------------+
| OmniBots Node.js Process (dashboard/server.js)                                  |
|                                                                                 |
|   +-----------------------+     +-----------------------+                       |
|   |   Express Web Server  |     |   Database Adapter    |                       |
|   |  - Trust Proxy: 1     | <-> |  - Atomic Local JSON  |                       |
|   |  - Health: /health    |     |  - MongoDB / Postgres |                       |
|   |  - Cookie: secure auto|     |  - AES-256-GCM Config |                       |
|   +-----------------------+     +-----------------------+                       |
|               |                                                                 |
|               v                                                                 |
|   +-------------------------------------------------------------+               |
|   | BotManager Multi-Bot Orchestrator                           |               |
|   |  - Client 1 (ClientReady, Intent Guard, Dual Command Router)| <-> Discord   |
|   |  - Client 2 (ClientReady, Intent Guard, Dual Command Router)|     Gateway   |
|   +-------------------------------------------------------------+               |
+---------------------------------------------------------------------------------+
```

- **Reverse Proxy Header Trust**: Configured with `app.set('trust proxy', 1);` so Express accurately detects client IP addresses for rate limiting and recognizes `X-Forwarded-Proto: https` from reverse proxies.
- **Dynamic Cookie Adaptation**: Uses `cookie: { secure: 'auto', sameSite: 'lax', httpOnly: true }` so administrative login sessions work seamlessly across HTTPS domains, HTTP test addresses, and custom subdomains without login redirect loops.
- **Immediate Port Binding**: Express binds to `0.0.0.0` and `PORT` immediately upon process execution, ensuring container health checks pass without delay.
- **Crash Protection**: Global `unhandledRejection` and `uncaughtException` guards trap Discord gateway connection timeouts and invalid token errors safely in logs without crashing the web application.

---

## Troubleshooting and Common Questions

#### 1. Why does my browser display "Not Secure"?
- **Cause**: Your domain is being accessed over plain `http://` instead of `https://`.
- **Solution**:
  - In Hostinger hPanel, go to **Security** > **SSL** and ensure **Force HTTPS** is turned **ON**.
  - On a Linux VPS, ensure you have run `sudo certbot --nginx -d yourdomain.com` to install an SSL certificate.
  - OmniBots serves all internal assets (`/images/logo.svg`, `/css/custom.css`) using root-relative paths, eliminating mixed-content warnings once SSL is active.

#### 2. Why does the dashboard display a warning about "Privileged Gateway Intents"?
- **Cause**: One or more of the three required intents (`Message Content`, `Server Members`, `Presence`) are disabled in the Discord Developer Portal.
- **Solution**:
  - Open the [Discord Developer Portal](https://discord.com/developers/applications).
  - Select your application, navigate to **Bot**, scroll down to **Privileged Gateway Intents**, and toggle all three options **ON**.
  - In the OmniBots Multi-Bot Hub, click **Restart** on the affected bot.

#### 3. Why are Slash Commands (`/`) not showing up in my Discord server?
- **Cause**: Application commands have not been synced via the REST API, or the bot was invited without the `applications.commands` scope.
- **Solution**:
  - In the OmniBots dashboard, navigate to **Multi-Bot Hub** and click **Sync Slash (/)**.
  - Re-invite the bot using the URL Generator ensuring both `bot` and `applications.commands` scopes are checked.

#### 4. Can I connect multiple bots to different servers?
- **Yes**: OmniBots is built specifically as a multi-bot fleet manager. You can add distinct bots for different communities, and manage all of them from the same dashboard login.

---

## License and Compliance

Distributed under the **MIT License**. Compliant with the Discord Developer Terms of Service and Discord Verification Guidelines. Includes built-in legal templates and data deletion features.
