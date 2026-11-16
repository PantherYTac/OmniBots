/**
 * OmniBots - Multi-Bot Orchestrator (BotManager)
 * Concurrently manages, monitors, and syncs multiple discord.js v14 clients.
 * Handles graceful intent error trapping, REST slash-command auto-sync, and live status.
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes
} = require('discord.js');
const { db } = require('../shared');
const { encrypt, decrypt } = require('../shared/config');
const logger = require('../shared/utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { applySettings } = require('./utils/presenceManager');

class BotManager {
  constructor() {
    /** @type {Map<string, Client>} */
    this.clients = new Map();
    /** @type {Map<string, Object>} */
    this.botMeta = new Map();
    /** @type {Collection} */
    this.commands = new Collection();
    this.isInitialized = false;
  }

  /**
   * Universal Gateway Intents & Partials
   */
  getClientOptions() {
    return {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ]
    };
  }

  /**
   * Initialize BotManager and auto-start all enabled bots
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Load application commands into memory registry
    const dummyClient = { commands: this.commands };
    loadCommands(dummyClient);
    logger.info(`Loaded ${this.commands.size} universal commands into memory registry`, 'BOT_MANAGER');

    // 2. Check for legacy/env DISCORD_TOKEN
    const envToken = (process.env.DISCORD_TOKEN || '').trim();
    if (envToken) {
      await this.startBotFromToken('primary', envToken, 'Primary Master Bot');
    }

    // 3. Load managed bots from database
    try {
      const savedBots = await db.managedBots.list();
      for (const botRecord of savedBots) {
        if (botRecord.id === 'primary' && envToken) continue; // Already started
        if (botRecord.enabled !== false) {
          const decryptedToken = decrypt(botRecord.tokenEncrypted);
          if (decryptedToken) {
            await this.startBotFromToken(botRecord.id, decryptedToken, botRecord.name);
          }
        }
      }
    } catch (err) {
      logger.error('Error loading managed bots from database', err, 'BOT_MANAGER');
    }
  }

  /**
   * Start a bot instance from token
   */
  async startBotFromToken(botId, token, displayName = 'Discord Bot') {
    if (this.clients.has(botId)) {
      await this.stopBot(botId);
    }

    const client = new Client(this.getClientOptions());
    client.commands = this.commands;
    client.botId = botId;

    // Setup Event Listeners
    loadEvents(client);

    // Metadata tracking
    const meta = {
      id: botId,
      name: displayName,
      status: 'starting',
      hasIntentError: false,
      intentErrorMessage: null,
      startedAt: Date.now(),
      guildsCount: 0,
      usersCount: 0
    };
    this.botMeta.set(botId, meta);

    try {
      // Connect to Discord Gateway
      await client.login(token);
      this.clients.set(botId, client);
      meta.status = 'online';

      logger.success(`Bot [${displayName}] logged in as ${client.user.tag} (ID: ${client.user.id})`, 'BOT_MANAGER');

      // Auto-Sync Slash Commands asynchronously in background (never blocks HTTP response)
      this.syncSlashCommands(botId, token).catch(syncErr => {
        logger.warn(`Background slash command sync warning for [${displayName}]: ${syncErr.message}`, 'BOT_MANAGER');
      });

      // Apply initial presence settings
      try {
        const botSettings = await db.botSettings.get();
        applySettings(client, botSettings);
      } catch {}

      // Update metadata in database
      await db.managedBots.save(botId, {
        id: botId,
        name: client.user.username,
        tag: client.user.tag,
        avatar: client.user.displayAvatarURL(),
        clientId: client.user.id,
        status: 'online',
        hasIntentError: false,
        guildsCount: client.guilds.cache.size,
        usersCount: client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0)
      });

      return client;
    } catch (err) {
      const errMsg = err.message || '';
      logger.error(`Failed to launch bot [${displayName}]: ${errMsg}`, null, 'BOT_MANAGER');

      // Detect Privileged Intents Error gracefully
      if (errMsg.includes('disallowed intents') || errMsg.includes('Privileged intent') || err.code === 'DisallowedIntents') {
        meta.hasIntentError = true;
        meta.intentErrorMessage = 'Missing Privileged Gateway Intents! Please turn ON "Message Content Intent", "Server Members Intent", and "Presence Intent" in the Discord Developer Portal under the Bot tab.';
        meta.status = 'intent_warning';
      } else {
        meta.status = 'error';
        meta.lastError = errMsg;
      }

      await db.managedBots.save(botId, {
        id: botId,
        name: displayName,
        status: meta.status,
        hasIntentError: meta.hasIntentError,
        lastError: meta.intentErrorMessage || errMsg
      });

      return {
        id: botId,
        name: displayName,
        status: meta.status,
        hasIntentError: meta.hasIntentError,
        intentErrorMessage: meta.intentErrorMessage,
        lastError: errMsg
      };
    }
  }

  /**
   * Synchronize slash commands with Discord REST API
   */
  async syncSlashCommands(botId, explicitToken = null) {
    const client = this.clients.get(botId);
    const token = explicitToken || (client ? client.token : null);
    if (!token) return { success: false, error: 'No token available for slash sync' };

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      let clientId = client?.user?.id;

      if (!clientId) {
        const selfData = await rest.get(Routes.user());
        clientId = selfData.id;
      }

      // Collect all command data payloads
      const slashPayloads = [];
      for (const cmd of this.commands.values()) {
        if (cmd.data && typeof cmd.data.toJSON === 'function') {
          slashPayloads.push(cmd.data.toJSON());
        }
      }

      logger.info(`Syncing ${slashPayloads.length} slash commands to Discord application (ID: ${clientId})...`, 'SLASH_SYNC');

      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: slashPayloads }
      );

      logger.success(`Successfully registered ${data.length} global application commands with Discord!`, 'SLASH_SYNC');
      return { success: true, count: data.length };
    } catch (err) {
      logger.error('Failed to sync slash commands via REST', err, 'SLASH_SYNC');
      return { success: false, error: err.message };
    }
  }

  /**
   * Stop a running bot
   */
  async stopBot(botId) {
    const client = this.clients.get(botId);
    if (client) {
      client.destroy();
      this.clients.delete(botId);
    }
    const meta = this.botMeta.get(botId);
    if (meta) {
      meta.status = 'stopped';
    }
    await db.managedBots.updateStatus(botId, 'stopped');
    logger.info(`Bot [${botId}] stopped cleanly.`, 'BOT_MANAGER');
    return true;
  }

  /**
   * Restart a running bot
   */
  async restartBot(botId) {
    const record = await db.managedBots.get(botId);
    if (!record) throw new Error(`Bot [${botId}] not found in database`);

    const token = decrypt(record.tokenEncrypted) || (botId === 'primary' ? process.env.DISCORD_TOKEN : null);
    if (!token) throw new Error('Could not decrypt bot token');

    await this.stopBot(botId);
    return this.startBotFromToken(botId, token, record.name || 'Discord Bot');
  }

  /**
   * Add a new bot from user input
   */
  async addBot(token, name = 'New Bot') {
    const trimmedToken = token.trim();
    // Validate token via REST before storing
    const rest = new REST({ version: '10' }).setToken(trimmedToken);
    const selfUser = await rest.get(Routes.user());

    const botId = `bot_${selfUser.id}`;
    const encrypted = encrypt(trimmedToken);

    await db.managedBots.save(botId, {
      id: botId,
      clientId: selfUser.id,
      name: name || selfUser.username,
      tag: `${selfUser.username}#${selfUser.discriminator || '0'}`,
      avatar: selfUser.avatar ? `https://cdn.discordapp.com/avatars/${selfUser.id}/${selfUser.avatar}.png` : null,
      tokenEncrypted: encrypted,
      status: 'starting',
      enabled: true,
      createdAt: Date.now()
    });

    return this.startBotFromToken(botId, trimmedToken, name || selfUser.username);
  }

  /**
   * Delete a managed bot
   */
  async deleteBot(botId) {
    await this.stopBot(botId);
    await db.managedBots.delete(botId);
    this.botMeta.delete(botId);
    return true;
  }

  /**
   * Get primary or active client
   */
  getPrimaryClient() {
    if (this.clients.has('primary')) return this.clients.get('primary');
    const first = this.clients.values().next();
    return first ? first.value : null;
  }

  /**
   * List all running and managed bot records
   */
  async listBots() {
    const saved = await db.managedBots.list();
    return saved.map(b => {
      const meta = this.botMeta.get(b.id);
      const liveClient = this.clients.get(b.id);
      return {
        ...b,
        status: meta ? meta.status : (b.status || 'stopped'),
        hasIntentError: meta ? meta.hasIntentError : false,
        intentErrorMessage: meta ? meta.intentErrorMessage : null,
        guildsCount: liveClient ? liveClient.guilds.cache.size : (b.guildsCount || 0),
        usersCount: liveClient ? liveClient.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) : (b.usersCount || 0)
      };
    });
  }
}

// Global Singleton
const botManager = new BotManager();

module.exports = {
  botManager,
  BotManager
};
