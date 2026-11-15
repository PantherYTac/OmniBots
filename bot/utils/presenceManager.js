/**
 * Global Bot Presence & Custom Status Manager
 * Handles dynamic variable substitution, rotation timers, and 15s database live sync
 */

let ActivityType;
try {
  ActivityType = require('discord.js').ActivityType;
} catch {
  ActivityType = {
    Playing: 0,
    Streaming: 1,
    Listening: 2,
    Watching: 3,
    Custom: 4,
    Competing: 5
  };
}
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

let cachedSettings = null;
let lastUpdatedAt = 0;
let rotationInterval = null;
let currentActivityIndex = 0;

/**
 * Map string activity types to Discord.js ActivityType enum
 */
function getActivityTypeEnum(typeStr) {
  switch ((typeStr || '').toUpperCase()) {
    case 'CUSTOM':
      return ActivityType.Custom;
    case 'PLAYING':
      return ActivityType.Playing;
    case 'STREAMING':
      return ActivityType.Streaming;
    case 'LISTENING':
      return ActivityType.Listening;
    case 'WATCHING':
      return ActivityType.Watching;
    case 'COMPETING':
      return ActivityType.Competing;
    default:
      return ActivityType.Custom;
  }
}

/**
 * Replace placeholders in status text: {servers}, {users}, {commands}
 */
function interpolateVariables(text, client) {
  if (!text) return '';
  const serverCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) || client.users.cache.size || 0;
  const commandCount = client.commands ? client.commands.size : 0;

  return text
    .replace(/\{servers\}/gi, serverCount.toLocaleString())
    .replace(/\{users\}/gi, userCount.toLocaleString())
    .replace(/\{commands\}/gi, commandCount.toLocaleString());
}

/**
 * Build Discord presence payload for a single activity
 */
function buildPresencePayload(activity, status, client) {
  const typeEnum = getActivityTypeEnum(activity.type);
  const parsedText = interpolateVariables(activity.text || '', client);

  let activityObj;
  if (typeEnum === ActivityType.Custom) {
    activityObj = {
      type: ActivityType.Custom,
      name: 'Custom Status',
      state: parsedText || 'Online'
    };
  } else if (typeEnum === ActivityType.Streaming) {
    activityObj = {
      name: parsedText || 'Live Stream',
      type: ActivityType.Streaming,
      url: activity.url && activity.url.startsWith('http') ? activity.url : 'https://www.twitch.tv/discord'
    };
  } else {
    activityObj = {
      name: parsedText || 'Discord',
      type: typeEnum
    };
  }

  const validStatus = ['online', 'idle', 'dnd', 'invisible'].includes(status) ? status : 'online';

  return {
    status: validStatus,
    activities: [activityObj]
  };
}

/**
 * Apply presence to Discord client
 */
function applyPresence(client, activity, status) {
  if (!client || !client.user) return;
  try {
    const payload = buildPresencePayload(activity, status, client);
    client.user.setPresence(payload);
  } catch (err) {
    logger.error('Failed to set bot presence', err, 'PRESENCE');
  }
}

/**
 * Configure and start/restart rotation or single presence
 */
function applySettings(client, settings) {
  if (!client || !client.user) return;
  cachedSettings = settings;
  lastUpdatedAt = settings.updatedAt || Date.now();

  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
  }

  const activities = Array.isArray(settings.activities) && settings.activities.length > 0
    ? settings.activities
    : [{ type: 'CUSTOM', text: 'Protecting {servers} servers with {users} users', url: '' }];

  const status = settings.status || 'online';

  if (settings.rotationEnabled && activities.length > 1) {
    const intervalSeconds = Math.max(15, parseInt(settings.rotationIntervalSeconds, 10) || 30);
    currentActivityIndex = 0;

    // Apply first activity immediately
    applyPresence(client, activities[currentActivityIndex], status);

    rotationInterval = setInterval(() => {
      currentActivityIndex = (currentActivityIndex + 1) % activities.length;
      applyPresence(client, activities[currentActivityIndex], status);
    }, intervalSeconds * 1000);

    logger.info(`Bot status rotation active (${activities.length} activities, ${intervalSeconds}s interval)`, 'PRESENCE');
  } else {
    // Single static activity
    currentActivityIndex = 0;
    applyPresence(client, activities[0], status);
  }
}

/**
 * Initialize Presence Manager: loads settings and starts 15s database polling worker
 */
async function initPresenceManager(client) {
  try {
    const initialSettings = await db.botSettings.get();
    applySettings(client, initialSettings);
  } catch (err) {
    logger.error('Failed to initialize bot presence from database', err, 'PRESENCE');
  }

  // 15-second Database Polling Sync
  setInterval(async () => {
    try {
      const current = await db.botSettings.get();
      if (!current) return;
      if (!cachedSettings || current.updatedAt !== lastUpdatedAt) {
        logger.info('Detected updated BotSettings in database. Applying new presence...', 'PRESENCE');
        applySettings(client, current);
      }
    } catch (err) {
      // Ignore background poll errors
    }
  }, 15000);
}

module.exports = {
  initPresenceManager,
  applySettings,
  getActivityTypeEnum,
  interpolateVariables
};
