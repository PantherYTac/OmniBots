/**
 * Discord Bot Worker Entrypoint (discord.js v14)
 * Orchestrated by OmniBots BotManager
 */

require('dotenv').config();
const { botManager } = require('./BotManager');
const { db } = require('../shared');
const logger = require('../shared/utils/logger');

async function startBot() {
  try {
    // 1. Initialize Shared Database Layer
    await db.init();

    // 2. Initialize BotManager & Auto-Start Configured Bots
    await botManager.init();

    const primaryClient = botManager.getPrimaryClient();
    if (!primaryClient) {
      logger.info('No Discord bots running yet. Add your bot token via the OmniBots Web Dashboard (Multi-Bot Hub)!', 'BOT_MANAGER');
    }

    return primaryClient;
  } catch (err) {
    logger.error('Critical failure starting Discord Bot Manager', err, 'BOT_MANAGER');
    return null;
  }
}

// Auto-start if executed directly (e.g. node bot/index.js)
if (require.main === module) {
  startBot();
}

module.exports = { startBot, botManager };
