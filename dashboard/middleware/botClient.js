/**
 * Discord REST / Bot Client Bridge
 * Works seamlessly whether Dashboard and Bot are in the same process or separate workers
 */

const { REST, Routes, ChannelType, ButtonStyle } = require('discord.js');
const logger = require('../../shared/utils/logger');
const { botManager } = require('../../bot/BotManager');

let inProcessClient = null;

function setInProcessClient(client) {
  inProcessClient = client;
}

function getClientForGuild(guildId) {
  if (inProcessClient && inProcessClient.guilds?.cache?.has(guildId)) {
    return inProcessClient;
  }
  for (const client of botManager.clients.values()) {
    if (client.guilds?.cache?.has(guildId)) {
      return client;
    }
  }
  return inProcessClient || botManager.getPrimaryClient();
}

function getRest() {
  const primary = botManager.getPrimaryClient();
  if (primary?.token) {
    return new REST({ version: '10' }).setToken(primary.token);
  }
  for (const client of botManager.clients.values()) {
    if (client?.token) return new REST({ version: '10' }).setToken(client.token);
  }
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;
  return new REST({ version: '10' }).setToken(token);
}

/**
 * Check if any managed bot is present in a guild
 */
async function isBotInGuild(guildId) {
  if (!guildId) return false;

  // 1. Check in-memory cache
  if (inProcessClient && inProcessClient.guilds?.cache?.has(guildId)) {
    return true;
  }
  for (const client of botManager.clients.values()) {
    if (client.guilds?.cache?.has(guildId)) {
      return true;
    }
  }

  // 2. Try fetching from live gateway clients
  for (const client of botManager.clients.values()) {
    try {
      const fetched = await client.guilds.fetch(guildId).catch(() => null);
      if (fetched) return true;
    } catch {}
  }

  // 3. Try Discord REST with available tokens
  try {
    const rest = getRest();
    if (rest) {
      await rest.get(Routes.guild(guildId));
      return true;
    }
  } catch {}

  // 4. Check if guild is already saved in database
  try {
    const { db } = require('../../shared');
    const saved = await db.guilds.get(guildId);
    if (saved) return true;
  } catch {}

  return false;
}

/**
 * Fetch text channels for a guild
 */
async function getGuildChannels(guildId) {
  const client = getClientForGuild(guildId);
  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
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
  const client = getClientForGuild(guildId);
  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
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
  const client = getClientForGuild(guildId);
  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
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
  const client = getClientForGuild(guildId);
  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
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
 * Fetch all guilds where any managed bot is a member
 */
async function getBotGuilds() {
  const guildMap = new Map();

  if (inProcessClient?.guilds?.cache) {
    for (const g of inProcessClient.guilds.cache.values()) {
      guildMap.set(g.id, {
        id: g.id,
        name: g.name,
        icon: g.icon,
        memberCount: g.memberCount,
        botInGuild: true
      });
    }
  }

  for (const client of botManager.clients.values()) {
    if (client.guilds?.cache) {
      for (const g of client.guilds.cache.values()) {
        if (!guildMap.has(g.id)) {
          guildMap.set(g.id, {
            id: g.id,
            name: g.name,
            icon: g.icon,
            memberCount: g.memberCount,
            botInGuild: true
          });
        }
      }
    }
  }

  if (guildMap.size > 0) {
    return Array.from(guildMap.values());
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

/**
 * Publish an interactive Ticket Panel to Discord
 */
async function publishTicketPanel(guildId, channelId, panelData, categories = []) {
  const client = getClientForGuild(guildId);
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

  const colorInt = panelData.panelEmbed?.color ? parseInt(panelData.panelEmbed.color.replace('#', ''), 16) : 0x5865F2;
  const embed = new EmbedBuilder()
    .setTitle(panelData.panelEmbed?.title || '🎫 Server Support Desk')
    .setDescription(panelData.panelEmbed?.description || 'Select a department below to open a ticket.')
    .setColor(isNaN(colorInt) ? 0x5865F2 : colorInt)
    .setFooter({ text: panelData.panelEmbed?.footer || 'Tickets are handled privately with staff' })
    .setTimestamp();

  if (panelData.panelEmbed?.bannerUrl) embed.setImage(panelData.panelEmbed.bannerUrl);

  const components = [];
  const styleMap = {
    'Primary': ButtonStyle.Primary,
    'Secondary': ButtonStyle.Secondary,
    'Success': ButtonStyle.Success,
    'Danger': ButtonStyle.Danger
  };

  if (panelData.selectorStyle === 'dropdown' || categories.length > 5) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_select_category')
      .setPlaceholder('Choose a department to open a ticket...')
      .addOptions(
        categories.slice(0, 25).map(c => ({
          label: c.name.substring(0, 100),
          description: (c.description || `Open a ${c.name} ticket`).substring(0, 100),
          value: c.id,
          emoji: c.emoji || undefined
        }))
      );
    components.push(new ActionRowBuilder().addComponents(select));
  } else {
    const buttons = categories.slice(0, 5).map(cat => {
      const btn = new ButtonBuilder()
        .setCustomId(`ticket_create:${cat.id}`)
        .setLabel(cat.name)
        .setStyle(styleMap[cat.buttonColor] || ButtonStyle.Primary);
      if (cat.emoji) btn.setEmoji(cat.emoji);
      return btn;
    });
    components.push(new ActionRowBuilder().addComponents(buttons));
  }

  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const msg = await channel.send({ embeds: [embed], components });
      return { id: msg.id, channelId: channel.id };
    }
  }

  const rest = getRest();
  if (!rest) throw new Error('Bot token is not configured.');
  const rawMsg = await rest.post(Routes.channelMessages(channelId), {
    body: {
      embeds: [embed.toJSON()],
      components: components.map(c => c.toJSON())
    }
  });
  return { id: rawMsg.id, channelId };
}

/**
 * Publish an interactive Application Panel to Discord
 */
async function publishApplicationPanel(guildId, channelId, form) {
  const client = getClientForGuild(guildId);
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const embedCfg = form.panelEmbed || {};
  const colorInt = embedCfg.color ? parseInt(embedCfg.color.replace('#', ''), 16) : 0x5865F2;

  const embed = new EmbedBuilder()
    .setTitle(embedCfg.title || `🛡️ ${form.name}`)
    .setDescription(embedCfg.description || form.description || 'Click the button below to submit your application.')
    .setColor(isNaN(colorInt) ? 0x5865F2 : colorInt)
    .setFooter({ text: 'Applications are reviewed privately by server leadership' })
    .setTimestamp();

  if (embedCfg.bannerUrl) embed.setImage(embedCfg.bannerUrl);

  const button = new ButtonBuilder()
    .setCustomId(`app_apply:${form.id}`)
    .setLabel(embedCfg.buttonText || 'Apply Now')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!form.isOpen);

  const components = [new ActionRowBuilder().addComponents(button)];

  if (client?.guilds?.cache) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const msg = await channel.send({ embeds: [embed], components });
      return { id: msg.id, channelId: channel.id };
    }
  }

  const rest = getRest();
  if (!rest) throw new Error('Bot token is not configured.');
  const rawMsg = await rest.post(Routes.channelMessages(channelId), {
    body: {
      embeds: [embed.toJSON()],
      components: components.map(c => c.toJSON())
    }
  });
  return { id: rawMsg.id, channelId };
}

/**
 * Update published Application Panel button when isOpen toggles
 */
async function updateApplicationPanelMessage(guildId, channelId, messageId, form) {
  try {
    const client = getClientForGuild(guildId);
    const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
    const embedCfg = form.panelEmbed || {};

    const button = new ButtonBuilder()
      .setCustomId(`app_apply:${form.id}`)
      .setLabel(form.isOpen ? (embedCfg.buttonText || 'Apply Now') : 'Applications Closed')
      .setStyle(form.isOpen ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!form.isOpen);

    const components = [new ActionRowBuilder().addComponents(button)];

    if (client?.guilds?.cache) {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          await msg.edit({ components }).catch(() => {});
          return;
        }
      }
    }

    const rest = getRest();
    if (rest) {
      await rest.patch(Routes.channelMessage(channelId, messageId), {
        body: { components: components.map(c => c.toJSON()) }
      }).catch(() => {});
    }
  } catch {}
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
  sendEmbedAnnouncement,
  publishTicketPanel,
  publishApplicationPanel,
  updateApplicationPanelMessage
};
