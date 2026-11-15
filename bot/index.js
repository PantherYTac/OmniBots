/**
 * Discord Bot Worker Entrypoint (discord.js v14)
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { db } = require('../shared');
const logger = require('../shared/utils/logger');

// Initialize Discord Client with full required intent suite
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();

async function startBot() {
  try {
    // 1. Initialize Shared Database Layer
    await db.init();

    // 2. Load Slash Commands & Event Listeners
    loadCommands(client);
    loadEvents(client);

    // 3. Connect to Discord Gateway
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      logger.error('Cannot start Discord Bot: DISCORD_TOKEN is missing in .env', null, 'BOT');
      return null;
    }

    await client.login(token);
    return client;
  } catch (err) {
    logger.error('Critical failure starting Discord Bot', err, 'BOT');
    throw err;
  }
}

// Auto-start if executed directly (e.g. node bot/index.js)
if (require.main === module) {
  startBot();
}

module.exports = { client, startBot };
