/**
 * Server Management Routes
 */

const express = require('express');
const router = express.Router();
const { requireAdminAuth, canManageGuild } = require('../middleware/auth');
const { db } = require('../../shared');
const {
  getGuildChannels,
  getGuildCategories,
  getGuildRoles,
  getGuildDetails,
  getInProcessClient
} = require('../middleware/botClient');
const { botManager } = require('../../bot/BotManager');

// 0.0 Multi-Bot Fleet Hub
router.get('/bots', requireAdminAuth, async (req, res) => {
  const bots = await botManager.listBots();
  res.render('bots', {
    user: req.session.user,
    bots,
    notice: req.query.notice ? String(req.query.notice) : null,
    error: req.query.error ? String(req.query.error) : null,
    tab: 'bots'
  });
});

// 0.01 Commands & Permissions Customization Manager
router.get('/:guildId/commands', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const commandsConfig = await db.commandsConfig.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);

  const commandsList = [];
  for (const cmd of botManager.commands.values()) {
    if (cmd.data && cmd.data.name) {
      commandsList.push({
        name: cmd.data.name,
        description: cmd.data.description || 'Universal application command',
        module: cmd.module || 'general',
        aliases: cmd.aliases || [],
        cooldown: cmd.cooldown || 3
      });
    }
  }

  commandsList.sort((a, b) => (a.module || '').localeCompare(b.module || '') || a.name.localeCompare(b.name));

  res.render('commands-manager', {
    user: req.session.user,
    guild: req.guild,
    commandsConfig,
    commandsList,
    channels,
    roles,
    tab: 'commands'
  });
});

// 0. Global Bot Presence & Custom Status Manager
router.get('/presence', requireAdminAuth, async (req, res) => {
  const botSettings = await db.botSettings.get();
  const botClient = getInProcessClient();
  const botUser = botClient?.user ? {
    username: botClient.user.username,
    tag: botClient.user.tag,
    avatar: botClient.user.displayAvatarURL({ size: 128 }),
    guildsCount: botClient.guilds.cache.size,
    usersCount: botClient.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0)
  } : {
    username: 'Discord Bot',
    tag: 'Bot#0000',
    avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    guildsCount: 0,
    usersCount: 0
  };

  res.render('presence', {
    user: req.session.user,
    botSettings,
    botUser,
    tab: 'presence'
  });
});

// 0.1 Discord Verification Legal Documents Editor
router.get('/legal', requireAdminAuth, async (req, res) => {
  const legalDocs = await db.legalDocuments.get();
  const baseUrl = process.env.DASHBOARD_URL || (req.protocol + '://' + req.get('host'));

  res.render('legal-editor', {
    user: req.session.user,
    legalDocs,
    baseUrl,
    tab: 'legal'
  });
});

// 1. Server Overview & Analytics
router.get('/:guildId', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const guild = (await getGuildDetails(guildId)) || req.guild;

  const openTickets = (await db.tickets.list(guildId)).filter(t => t.status === 'open');
  const automodTriggersToday = await db.auditLogs.countToday(guildId, 'AUTOMOD_TRIGGER');
  const recentLogs = await db.auditLogs.getRecent(guildId, 10);

  const leaderboard = await db.levels.getLeaderboard(guildId, 1);
  const topUser = leaderboard[0] ? { name: leaderboard[0].userName || `Member #${leaderboard[0].userId}`, level: leaderboard[0].level, xp: leaderboard[0].xp } : null;

  // 7-day labels & data
  const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartMsgData = [45, 78, 112, 134, 180, 225, 195];
  const chartXpData = [280, 420, 590, 780, 1050, 1320, 1200];

  res.render('overview', {
    user: req.session.user,
    guild,
    settings,
    openTicketsCount: openTickets.length,
    automodTriggersToday,
    topUser,
    recentLogs,
    chartLabels,
    chartMsgData,
    chartXpData
  });
});

// 2. General & Module Settings
router.get('/:guildId/general', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  res.render('general', {
    user: req.session.user,
    guild: req.guild,
    settings
  });
});

// 3. Auto-Moderation & Rule Engine
router.get('/:guildId/automod', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);

  res.render('automod', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    roles
  });
});

// 4. Reaction & Button Role Builder
router.get('/:guildId/reaction-roles', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);

  res.render('reaction-roles', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    roles
  });
});

// 5. Embed & Announcement Designer
router.get('/:guildId/embeds', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const channels = await getGuildChannels(guildId);

  res.render('embeds', {
    user: req.session.user,
    guild: req.guild,
    channels
  });
});

// 6. Welcomer & Farewell Designer
router.get('/:guildId/welcomer', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);

  res.render('welcomer', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels
  });
});

// 7. Custom Commands Manager
router.get('/:guildId/custom-commands', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const commands = await db.customCommands.list(guildId);

  res.render('custom-commands', {
    user: req.session.user,
    guild: req.guild,
    commands
  });
});

// 8. Leveling & Shop Manager
router.get('/:guildId/leveling', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);
  const shopItems = await db.shop.list(guildId);

  res.render('leveling', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    roles,
    shopItems
  });
});

// 9. Support Tickets Studio & Saved Transcripts
router.get('/:guildId/tickets', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const categories = await getGuildCategories(guildId);
  const roles = await getGuildRoles(guildId);
  const ticketList = await db.tickets.list(guildId);
  const ticketCategories = await db.ticketCategories.list(guildId);
  const ticketPanels = await db.ticketPanels.list(guildId);

  res.render('tickets', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    categories,
    roles,
    ticketList,
    ticketCategories,
    ticketPanels,
    tab: 'tickets'
  });
});

// 9b. HTML Transcript Direct Browser Viewer
router.get('/:guildId/tickets/:ticketId/transcript', requireAdminAuth, canManageGuild, async (req, res) => {
  const ticketId = req.params.ticketId;
  const ticket = await db.tickets.get(ticketId);

  if (!ticket || (!ticket.htmlTranscript && !ticket.transcriptHtml)) {
    return res.status(404).render('transcript', { ticket: null });
  }

  return res.render('transcript', { ticket });
});

// 10. Staff & Community Applications Manager
router.get('/:guildId/applications', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);
  const forms = await db.applicationForms.list(guildId);
  const submissions = await db.applicationSubmissions.list(guildId);

  res.render('applications', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    roles,
    forms,
    submissions,
    tab: 'applications'
  });
});

// 11. Invite Tracker & Analytics
router.get('/:guildId/invites', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const settings = await db.guilds.get(guildId);
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);
  const inviters = await db.invites.getLeaderboard(guildId, 100);

  res.render('invites', {
    user: req.session.user,
    guild: req.guild,
    settings,
    channels,
    roles,
    inviters,
    tab: 'invites'
  });
});

module.exports = router;
