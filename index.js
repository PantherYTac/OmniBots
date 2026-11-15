/**
 * Unified Monorepo Runner & Hostinger Process Orchestrator
 * Supports single-container all-in-one deployment or independent worker modes
 */

require('dotenv').config();
const { startDashboard } = require('./dashboard/server');
const { startBot } = require('./bot/index');
const { setInProcessClient } = require('./dashboard/middleware/botClient');
const logger = require('./shared/utils/logger');

const mode = (process.env.APP_MODE || 'all').toLowerCase();

(async () => {
  logger.info(`Starting Application in [${mode.toUpperCase()}] mode...`, 'ORCHESTRATOR');

  try {
    if (mode === 'all') {
      // 1. Start the Discord Bot Worker
      const botClient = await startBot();

      // 2. Link in-process client to dashboard for high-speed IPC
      if (botClient) {
        setInProcessClient(botClient);
      }

      // 3. Start the Express Web Dashboard
      await startDashboard();

      logger.success('All systems operational! Bot and Dashboard are running synchronously.', 'ORCHESTRATOR');
    } else if (mode === 'dashboard') {
      await startDashboard();
    } else if (mode === 'bot') {
      await startBot();
    } else {
      logger.error(`Unknown APP_MODE: "${mode}". Valid options are: all, dashboard, bot`, null, 'ORCHESTRATOR');
      process.exit(1);
    }
  } catch (err) {
    logger.error('Fatal crash during application startup', err, 'ORCHESTRATOR');
    process.exit(1);
  }
})();
