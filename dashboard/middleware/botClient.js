/**
 * Discord REST / Bot Client Bridge
 * Works seamlessly whether Dashboard and Bot are in the same process or separate workers
 */

const { REST, Routes, ChannelType, ButtonStyle } = require('discord.js');
const logger = require('../../shared/utils/logger');

let inProcessClient = null;

function setInProcessClient(client) {
  inProcessClient = client;
}

function getRest() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;
  return new REST({ version: '10' }).setToken(token);
}

/**
 * Check if the bot is present in a guild
 */
async function isBotInGuild(guildId) {
  if (inProcessClient) {
    return inProcessClient.guilds.cache.has(guildId);
  }
  try {
    const rest = getRest();
    if (!rest) return false;
    await rest.get(Routes.guild(guildId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch text channels for a guild
 */
async function getGuildChannels(guildId) {
  if (inProcessClient) {
    const guild = inProcessClient.guilds.cache.get(guildId);
    if (guild) {
      return guild.channels.cache
        .filter(c => c.isTextBased())
        .map(c => ({ id: c.id, name: c.name, type: c.type }));
    }
  }

  try {
    const rest = getRest();
    if (!rest) return [];
    const channels = await rest.get(Routes.guildChannels(guildId));
    return channels
      .filter(c => c.type === ChannelType.GuildText || c.type === 0)
      .map(c => ({ id: c.id, name: c.name, type: c.type }));
  } catch (err) {
    logger.error(`Error fetching channels for guild ${guildId}`, err, 'DASHBOARD_API');
    return [];
  }
}

/**
 * Fetch categories for a guild
 */
async function getGuildCategories(guildId) {
  if (inProcessClient) {
    const guild = inProcessClient.guilds.cache.get(guildId);
    if (guild) {
      return guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => ({ id: c.id, name: c.name }));
    }
  }

  try {
    const rest = getRest();
    if (!rest) return [];
    const channels = await rest.get(Routes.guildChannels(guildId));
    return channels
      .filter(c => c.type === ChannelType.GuildCategory || c.type === 4)
      .map(c => ({ id: c.id, name: c.name }));
  } catch (err) {
    return [];
  }
}

/**
 * Fetch roles for a guild
 */
async function getGuildRoles(guildId) {
  if (inProcessClient) {
    const guild = inProcessClient.guilds.cache.get(guildId);
    if (guild) {
      return guild.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => ({ id: r.id, name: r.name, color: r.color }));
    }
  }

  try {
    const rest = getRest();
    if (!rest) return [];
    const roles = await rest.get(Routes.guildRoles(guildId));
    return roles
      .filter(r => r.id !== guildId)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.color }));
  } catch (err) {
    logger.error(`Error fetching roles for guild ${guildId}`, err, 'DASHBOARD_API');
    return [];
  }
}

/**
 * Fetch guild member count and details
 */
async function getGuildDetails(guildId) {
  if (inProcessClient) {
    const guild = inProcessClient.guilds.cache.get(guildId);
    if (guild) {
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount
      };
    }
  }

  try {
    const rest = getRest();
    if (!rest) return null;
    const g = await rest.get(Routes.guild(guildId), { query: new URLSearchParams({ with_counts: 'true' }) });
    return {
      id: g.id,
      name: g.name,
      icon: g.icon,
      memberCount: g.approximate_member_count || 0
    };
  } catch {
    return null;
  }
}

/**
 * Publish a reaction / button role panel to Discord
 */
async function publishReactionPanel(guildId, channelId, title, description, buttons, mode) {
  const rest = getRest();
  if (!rest) throw new Error('Bot token is not configured.');

  const embed = {
    title,
    description,
    color: 0x5865F2,
    footer: { text: `Mode: ${mode.toUpperCase()} • Click to assign` }
  };

  const actionComponents = buttons.map(b => ({
    type: 2, // BUTTON
    style: 2, // Secondary (Gray)
    label: b.label,
    emoji: b.emoji ? { name: b.emoji } : undefined,
    custom_id: `rr:${b.roleId}:${mode}:panel`
  }));

  const components = [
    {
      type: 1, // ACTION_ROW
      components: actionComponents
    }
  ];

  return rest.post(Routes.channelMessages(channelId), {
    body: {
      embeds: [embed],
      components
    }
  });
}

/**
 * Send an embed announcement to a channel
 */
async function sendEmbedAnnouncement(channelId, embedData) {
  const rest = getRest();
  if (!rest) throw new Error('Bot token is not configured.');

  const colorInt = embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0x5865F2;

  const embed = {
    title: embedData.title,
    description: embedData.description,
    color: isNaN(colorInt) ? 0x5865F2 : colorInt,
    thumbnail: embedData.thumbnailUrl ? { url: embedData.thumbnailUrl } : undefined,
    image: embedData.imageUrl ? { url: embedData.imageUrl } : undefined,
    footer: embedData.footerText ? { text: embedData.footerText } : undefined,
    timestamp: new Date().toISOString()
  };

  return rest.post(Routes.channelMessages(channelId), {
    body: { embeds: [embed] }
  });
}

/**
 * Fetch all guilds where the bot is a member (using in-process client or Bot token)
 */
async function getBotGuilds() {
  if (inProcessClient) {
    return Array.from(inProcessClient.guilds.cache.values()).map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      memberCount: g.memberCount,
      botInGuild: true
    }));
  }

  try {
    const rest = getRest();
    if (!rest) return [];
    const guilds = await rest.get(Routes.userGuilds());
    return guilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      botInGuild: true
    }));
  } catch (err) {
    logger.error('Error fetching bot guilds via REST', err, 'BOT_CLIENT');
    return [];
  }
}

module.exports = {
  setInProcessClient,
  getInProcessClient: () => inProcessClient,
  isBotInGuild,
  getBotGuilds,
  getGuildChannels,
  getGuildCategories,
  getGuildRoles,
  getGuildDetails,
  publishReactionPanel,
  sendEmbedAnnouncement
};
