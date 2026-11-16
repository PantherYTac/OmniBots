/**
 * REST API Endpoints for Dashboard UI Actions
 */

const express = require('express');
const router = express.Router();
const { requireAdminAuth, canManageGuild } = require('../middleware/auth');
const { db } = require('../../shared');
const {
  publishReactionPanel,
  sendEmbedAnnouncement,
  getInProcessClient,
  publishTicketPanel,
  publishApplicationPanel,
  updateApplicationPanelMessage,
  getClientForGuild
} = require('../middleware/botClient');
const { applySettings } = require('../../bot/utils/presenceManager');
const { botManager } = require('../../bot/BotManager');
const logger = require('../../shared/utils/logger');

// 1. General & Module Settings Save
router.post('/guilds/:guildId/general', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const current = await db.guilds.get(guildId);

  const prefix = req.body.prefix || current.prefix;
  const language = req.body.language || current.language;
  const embedColor = req.body.embedColor || current.embedColor;

  // Rebuild modules map from form data
  const modules = { ...current.modules };
  if (req.body.modules) {
    Object.keys(modules).forEach(k => {
      modules[k] = req.body.modules[k] === true || req.body.modules[k] === 'true';
    });
  }

  await db.guilds.update(guildId, { prefix, language, embedColor, modules });
  return res.json({ success: true, message: 'General settings updated successfully!' });
});

// 2. Auto-Mod Settings Save
router.post('/guilds/:guildId/automod', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const current = await db.guilds.get(guildId);

  let bannedWords = [];
  if (typeof req.body.bannedWords === 'string') {
    bannedWords = req.body.bannedWords.split(/[,\n]/).map(w => w.trim()).filter(Boolean);
  }

  const automod = {
    ...current.automod,
    antiInvites: Boolean(req.body.antiInvites),
    antiLinks: Boolean(req.body.antiLinks),
    antiSpam: Boolean(req.body.antiSpam),
    mentionThreshold: parseInt(req.body.mentionThreshold, 10) || 5,
    emojiThreshold: parseInt(req.body.emojiThreshold, 10) || 8,
    bannedWords
  };

  const stickyRoles = {
    ...current.stickyRoles,
    enabled: Boolean(req.body.stickyRolesEnabled)
  };

  await db.guilds.update(guildId, { automod, stickyRoles });
  return res.json({ success: true, message: 'Auto-Moderation rules updated successfully!' });
});

// 3. Welcomer & Farewell Save
router.post('/guilds/:guildId/welcomer', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const current = await db.guilds.get(guildId);

  const welcome = {
    ...current.welcome,
    enabled: Boolean(req.body.welcomeEnabled),
    channelId: req.body.welcomeChannelId || '',
    message: req.body.welcomeMessage || '',
    sendCard: Boolean(req.body.welcomeSendCard)
  };

  const farewell = {
    ...current.farewell,
    enabled: Boolean(req.body.farewellEnabled),
    channelId: req.body.farewellChannelId || '',
    message: req.body.farewellMessage || ''
  };

  await db.guilds.update(guildId, { welcome, farewell });
  return res.json({ success: true, message: 'Welcomer settings updated successfully!' });
});

// 4. Leveling Settings Save
router.post('/guilds/:guildId/leveling', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const current = await db.guilds.get(guildId);

  const leveling = {
    ...current.leveling,
    xpRate: parseFloat(req.body.xpRate) || 1.0,
    announcementChannelId: req.body.announcementChannelId || '',
    message: req.body.levelMessage || ''
  };

  await db.guilds.update(guildId, { leveling });
  return res.json({ success: true, message: 'Leveling settings updated successfully!' });
});

// 5. Ticket Configuration Save
router.post('/guilds/:guildId/tickets', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const current = await db.guilds.get(guildId);

  const tickets = {
    ...current.tickets,
    supportRoleId: req.body.supportRoleId || '',
    categoryId: req.body.categoryId || '',
    logChannelId: req.body.logChannelId || ''
  };

  await db.guilds.update(guildId, { tickets });
  return res.json({ success: true, message: 'Support ticket settings saved!' });
});

// 5b. Ticket Categories CRUD
router.post('/guilds/:guildId/tickets/categories', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const {
      id,
      name,
      emoji,
      description,
      buttonColor,
      discordCategoryId,
      closedCategoryId,
      channelNamePattern,
      supportRoleIds,
      modalQuestions,
      welcomeEmbed,
      maxOpenPerUser,
      autoCloseInactiveHours
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }

    const catId = id || `cat_${Date.now()}`;
    const saved = await db.ticketCategories.save(catId, {
      guildId,
      name: name.trim(),
      emoji: emoji || '🎫',
      description: description || '',
      buttonColor: buttonColor || 'Primary',
      discordCategoryId: discordCategoryId || '',
      closedCategoryId: closedCategoryId || '',
      channelNamePattern: channelNamePattern || 'ticket-{category}-{username}-{count}',
      supportRoleIds: Array.isArray(supportRoleIds) ? supportRoleIds : (supportRoleIds ? [supportRoleIds] : []),
      modalQuestions: typeof modalQuestions === 'string' ? JSON.parse(modalQuestions) : (modalQuestions || []),
      welcomeEmbed: typeof welcomeEmbed === 'string' ? JSON.parse(welcomeEmbed) : (welcomeEmbed || {}),
      maxOpenPerUser: parseInt(maxOpenPerUser, 10) || 1,
      autoCloseInactiveHours: parseInt(autoCloseInactiveHours, 10) || 0
    });

    return res.json({ success: true, message: 'Category saved successfully!', category: saved });
  } catch (err) {
    logger.error('Failed to save ticket category', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to save ticket category.' });
  }
});

router.delete('/guilds/:guildId/tickets/categories/:id', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    await db.ticketCategories.delete(req.params.id);
    return res.json({ success: true, message: 'Category deleted successfully!' });
  } catch (err) {
    logger.error('Failed to delete ticket category', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to delete category.' });
  }
});

// 5c. Ticket Panels CRUD & Discord Publisher
router.post('/guilds/:guildId/tickets/panels', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { id, title, description, color, bannerUrl, selectorStyle, categoryIds } = req.body;

    const panelId = id || `panel_${Date.now()}`;
    const saved = await db.ticketPanels.save(panelId, {
      guildId,
      selectorStyle: selectorStyle || 'buttons',
      panelEmbed: {
        title: title || '🎫 Server Support Desk',
        description: description || 'Select a department below to open a ticket.',
        color: color || '#5865F2',
        bannerUrl: bannerUrl || '',
        footer: 'Tickets are handled privately with staff'
      },
      categoryIds: Array.isArray(categoryIds) ? categoryIds : (categoryIds ? [categoryIds] : [])
    });

    return res.json({ success: true, message: 'Ticket panel configuration saved!', panel: saved });
  } catch (err) {
    logger.error('Failed to save ticket panel', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to save panel.' });
  }
});

router.delete('/guilds/:guildId/tickets/panels/:id', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    await db.ticketPanels.delete(req.params.id);
    return res.json({ success: true, message: 'Ticket panel deleted successfully!' });
  } catch (err) {
    logger.error('Failed to delete ticket panel', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to delete panel.' });
  }
});

router.post('/guilds/:guildId/tickets/publish-panel', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { panelId, channelId } = req.body;

    if (!panelId || !channelId) {
      return res.status(400).json({ success: false, error: 'Panel ID and target Channel ID are required.' });
    }

    const panel = await db.ticketPanels.get(panelId);
    if (!panel) return res.status(404).json({ success: false, error: 'Panel configuration not found.' });

    const allCategories = await db.ticketCategories.list(guildId);
    const categoriesToPublish = Array.isArray(panel.categoryIds) && panel.categoryIds.length > 0
      ? allCategories.filter(c => panel.categoryIds.includes(c.id))
      : allCategories;

    if (categoriesToPublish.length === 0) {
      return res.status(400).json({ success: false, error: 'No ticket categories assigned to this panel.' });
    }

    const published = await publishTicketPanel(guildId, channelId, panel, categoriesToPublish);

    await db.ticketPanels.save(panelId, {
      channelId,
      messageId: published.id
    });

    return res.json({ success: true, message: 'Ticket panel published live to Discord!', messageId: published.id });
  } catch (err) {
    logger.error('Failed to publish ticket panel to Discord', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to post ticket panel to Discord.' });
  }
});

// 6. Publish Reaction & Button Role Panel to Discord
router.post('/guilds/:guildId/publish-reaction-panel', requireAdminAuth, canManageGuild, async (req, res) => {
  const guildId = req.params.guildId;
  const { channelId, title, description, mode } = req.body;

  const labels = Array.isArray(req.body['roleLabel[]']) ? req.body['roleLabel[]'] : [req.body['roleLabel[]'] || 'Role'];
  const emojis = Array.isArray(req.body['roleEmoji[]']) ? req.body['roleEmoji[]'] : [req.body['roleEmoji[]'] || ''];
  const roleIds = Array.isArray(req.body['roleId[]']) ? req.body['roleId[]'] : [req.body['roleId[]']];

  const buttons = [];
  for (let i = 0; i < roleIds.length; i++) {
    if (roleIds[i]) {
      buttons.push({
        label: labels[i] || 'Role',
        emoji: emojis[i] || undefined,
        roleId: roleIds[i]
      });
    }
  }

  if (buttons.length === 0) {
    return res.status(400).json({ success: false, error: 'Please specify at least one role button.' });
  }

  try {
    const publishedMsg = await publishReactionPanel(guildId, channelId, title, description, buttons, mode || 'normal');

    // Register panel in DB
    const current = await db.guilds.get(guildId);
    const reactionRoles = current.reactionRoles || [];
    reactionRoles.push({
      panelId: `panel_${Date.now()}`,
      channelId,
      messageId: publishedMsg.id,
      title,
      description,
      mode: mode || 'normal',
      roles: buttons
    });
    await db.guilds.update(guildId, { reactionRoles });

    return res.json({ success: true, message: 'Reaction Role Panel published successfully to Discord!' });
  } catch (err) {
    logger.error('Failed to publish reaction panel to Discord', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to post message to Discord.' });
  }
});

// 7. Send Embed Announcement to Discord Channel
router.post('/guilds/:guildId/send-embed', requireAdminAuth, canManageGuild, async (req, res) => {
  const { channelId, title, description, color, thumbnailUrl, imageUrl, footerText } = req.body;

  if (!channelId || !title || !description) {
    return res.status(400).json({ success: false, error: 'Channel, Title, and Description are required.' });
  }

  try {
    await sendEmbedAnnouncement(channelId, { title, description, color, thumbnailUrl, imageUrl, footerText });
    return res.json({ success: true, message: 'Embed announcement sent successfully!' });
  } catch (err) {
    logger.error('Failed to send embed announcement', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to send embed.' });
  }
});

// 8. Custom Commands CRUD
router.post('/guilds/:guildId/custom-commands', requireAdminAuth, canManageGuild, async (req, res) => {
  const { trigger, response } = req.body;
  if (!trigger || !response) {
    return res.status(400).json({ success: false, error: 'Trigger and Response are required.' });
  }

  await db.customCommands.set(req.params.guildId, trigger, response, req.session.user.username);
  return res.json({ success: true, message: 'Command saved!' });
});

router.delete('/guilds/:guildId/custom-commands/:trigger', requireAdminAuth, canManageGuild, async (req, res) => {
  await db.customCommands.remove(req.params.guildId, req.params.trigger);
  return res.json({ success: true, message: 'Command deleted.' });
});

// 9. Level Role Rewards CRUD
router.post('/guilds/:guildId/level-roles', requireAdminAuth, canManageGuild, async (req, res) => {
  const level = parseInt(req.body.level, 10);
  const roleId = req.body.roleId;

  if (isNaN(level) || !roleId) {
    return res.status(400).json({ success: false, error: 'Valid Level and Role are required.' });
  }

  const current = await db.guilds.get(req.params.guildId);
  const leveling = current.leveling || {};
  let levelRoles = leveling.levelRoles || [];

  levelRoles = levelRoles.filter(r => r.level !== level);
  levelRoles.push({ level, roleId });
  levelRoles.sort((a, b) => a.level - b.level);

  leveling.levelRoles = levelRoles;
  await db.guilds.update(req.params.guildId, { leveling });

  return res.json({ success: true, message: 'Level role reward added!' });
});

router.delete('/guilds/:guildId/level-roles/:level', requireAdminAuth, canManageGuild, async (req, res) => {
  const level = parseInt(req.params.level, 10);
  const current = await db.guilds.get(req.params.guildId);
  const leveling = current.leveling || {};
  leveling.levelRoles = (leveling.levelRoles || []).filter(r => r.level !== level);

  await db.guilds.update(req.params.guildId, { leveling });
  return res.json({ success: true, message: 'Level role removed.' });
});

// 10. Server Shop CRUD
router.post('/guilds/:guildId/shop-items', requireAdminAuth, canManageGuild, async (req, res) => {
  const { name, price, roleId, description } = req.body;
  if (!name || isNaN(price)) {
    return res.status(400).json({ success: false, error: 'Item Name and Price are required.' });
  }

  await db.shop.add({
    guildId: req.params.guildId,
    name,
    price: parseInt(price, 10),
    roleId: roleId || null,
    description: description || ''
  });

  return res.json({ success: true, message: 'Shop item created!' });
});

router.delete('/guilds/:guildId/shop-items/:id', requireAdminAuth, canManageGuild, async (req, res) => {
  await db.shop.remove(req.params.guildId, req.params.id);
  return res.json({ success: true, message: 'Shop item deleted.' });
});

// 11. Global Bot Presence & Status API
router.post('/bot/presence', requireAdminAuth, async (req, res) => {
  try {
    const { status, rotationEnabled, rotationIntervalSeconds } = req.body;
    let activities = req.body.activities;

    if (typeof activities === 'string') {
      try {
        activities = JSON.parse(activities);
      } catch {
        activities = [];
      }
    }

    if (!Array.isArray(activities) || activities.length === 0) {
      activities = [{ type: 'CUSTOM', text: '⚡ Protecting {servers} servers with {users} users', url: '' }];
    }

    const payload = {
      status: ['online', 'idle', 'dnd', 'invisible'].includes(status) ? status : 'online',
      rotationEnabled: rotationEnabled === true || rotationEnabled === 'true' || rotationEnabled === 'on',
      rotationIntervalSeconds: Math.max(15, Math.min(300, parseInt(rotationIntervalSeconds, 10) || 30)),
      activities: activities.map(a => ({
        type: (a.type || 'CUSTOM').toUpperCase(),
        text: (a.text || '').trim(),
        url: (a.url || '').trim()
      }))
    };

    const saved = await db.botSettings.set(payload);

    // Apply immediately to live in-process Discord client if present
    const botClient = getInProcessClient();
    if (botClient && botClient.user) {
      applySettings(botClient, saved);
    }

    logger.success('Global bot presence settings updated via Web Dashboard', 'PRESENCE_API');
    return res.json({ success: true, message: 'Bot presence applied and saved successfully!', settings: saved });
  } catch (err) {
    logger.error('Failed to update bot presence', err, 'PRESENCE_API');
    return res.status(500).json({ success: false, error: 'Internal server error updating bot presence.' });
  }
});

// 12. Invite Tracker Settings API
router.post('/guilds/:guildId/invites/settings', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const current = await db.guilds.get(guildId);

    const enabled = req.body.enabled === true || req.body.enabled === 'true' || req.body.enabled === 'on';
    const minAccountAgeDays = Math.max(0, parseInt(req.body.minAccountAgeDays, 10) || 7);
    const subtractLeaves = req.body.subtractLeaves === true || req.body.subtractLeaves === 'true' || req.body.subtractLeaves === 'on';

    const joinChannelId = req.body.joinChannelId !== undefined ? req.body.joinChannelId : (current.inviteTracking?.joinChannelId || '');
    const joinCardEnabled = req.body.joinCardEnabled === true || req.body.joinCardEnabled === 'true' || req.body.joinCardEnabled === 'on';
    const joinAccentColor = req.body.joinAccentColor || current.inviteTracking?.joinAccentColor || '#5865F2';
    const joinGradientStart = req.body.joinGradientStart || current.inviteTracking?.joinGradientStart || '#0B0E14';
    const joinGradientEnd = req.body.joinGradientEnd || current.inviteTracking?.joinGradientEnd || '#131823';

    const joinEmbed = {
      author: req.body.joinAuthor || current.inviteTracking?.joinEmbed?.author || 'New Member Arrived!',
      description: req.body.joinDescription || current.inviteTracking?.joinEmbed?.description ||
        'Welcome {user} (**{user.tag}**) to **{server}**!\n\n📨 **Invited by:** {inviter} (**{inviter.tag}**)\n🏆 **Inviter Total:** **{inviter.invites}** invites (`{invite.code}`)\n👥 **Member Count:** #{member_count}',
      color: joinAccentColor
    };

    const leaveChannelId = req.body.leaveChannelId !== undefined ? req.body.leaveChannelId : (current.inviteTracking?.leaveChannelId || '');
    const leaveEmbed = {
      description: req.body.leaveDescription || current.inviteTracking?.leaveEmbed?.description ||
        '**{user.tag}** has left the server.\nInvited by **{inviter.tag}** — they now have **{inviter.invites}** invites.',
      color: req.body.leaveColor || current.inviteTracking?.leaveEmbed?.color || '#EF4444'
    };

    const inviteTracking = {
      ...(current.inviteTracking || {}),
      enabled,
      minAccountAgeDays,
      subtractLeaves,
      joinChannelId,
      joinCardEnabled,
      joinAccentColor,
      joinGradientStart,
      joinGradientEnd,
      joinEmbed,
      leaveChannelId,
      leaveEmbed
    };

    const modules = {
      ...(current.modules || {}),
      inviteTracker: enabled
    };

    await db.guilds.update(guildId, { inviteTracking, modules });
    return res.json({ success: true, message: 'Invite Tracker settings updated successfully!' });
  } catch (err) {
    logger.error('Failed to update invite settings', err, 'INVITES_API');
    return res.status(500).json({ success: false, error: 'Internal error updating invite settings.' });
  }
});

// 13. Invite Role Rewards API
router.post('/guilds/:guildId/invites/rewards', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const threshold = parseInt(req.body.threshold, 10);
    const roleId = req.body.roleId;

    if (isNaN(threshold) || threshold < 1 || !roleId) {
      return res.status(400).json({ success: false, error: 'Valid invite threshold (>0) and Role are required.' });
    }

    const current = await db.guilds.get(guildId);
    const inviteTracking = current.inviteTracking || { enabled: true, minAccountAgeDays: 7, subtractLeaves: true, rewards: [] };
    let rewards = inviteTracking.rewards || [];

    // Filter out existing reward for same threshold and replace
    rewards = rewards.filter(r => parseInt(r.threshold, 10) !== threshold);
    rewards.push({ threshold, roleId });
    rewards.sort((a, b) => a.threshold - b.threshold);

    inviteTracking.rewards = rewards;
    await db.guilds.update(guildId, { inviteTracking });

    return res.json({ success: true, message: 'Invite milestone role reward added!' });
  } catch (err) {
    logger.error('Failed to add invite role reward', err, 'INVITES_API');
    return res.status(500).json({ success: false, error: 'Internal error adding invite role reward.' });
  }
});

router.delete('/guilds/:guildId/invites/rewards/:threshold', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const threshold = parseInt(req.params.threshold, 10);

    const current = await db.guilds.get(guildId);
    const inviteTracking = current.inviteTracking || { enabled: true, minAccountAgeDays: 7, subtractLeaves: true, rewards: [] };
    inviteTracking.rewards = (inviteTracking.rewards || []).filter(r => parseInt(r.threshold, 10) !== threshold);

    await db.guilds.update(guildId, { inviteTracking });
    return res.json({ success: true, message: 'Role reward removed.' });
  } catch (err) {
    logger.error('Failed to delete invite role reward', err, 'INVITES_API');
    return res.status(500).json({ success: false, error: 'Internal error deleting invite role reward.' });
  }
});

// 14. Manual Bonus / Reset Invites API
router.post('/guilds/:guildId/invites/bonus', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { userId, amount } = req.body;

    if (!userId || isNaN(parseInt(amount, 10))) {
      return res.status(400).json({ success: false, error: 'User ID and integer Amount are required.' });
    }

    const updated = await db.invites.addBonus(guildId, userId, parseInt(amount, 10));
    return res.json({ success: true, message: `Successfully updated bonus invites for user!`, record: updated });
  } catch (err) {
    logger.error('Failed to add bonus invites', err, 'INVITES_API');
    return res.status(500).json({ success: false, error: 'Internal error modifying bonus invites.' });
  }
});

router.post('/guilds/:guildId/invites/reset', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const userId = req.body.userId || null;

    await db.invites.reset(guildId, userId);
    return res.json({ success: true, message: userId ? `Invites reset for user ${userId}.` : 'All server invites reset to 0.' });
  } catch (err) {
    logger.error('Failed to reset invites', err, 'INVITES_API');
    return res.status(500).json({ success: false, error: 'Internal error resetting invites.' });
  }
});

// 15. Legal Documents & Discord Verification API
router.post('/bot/legal', requireAdminAuth, async (req, res) => {
  try {
    const { contactEmail, supportServerInvite, privacyPolicy, termsOfService } = req.body;

    const saved = await db.legalDocuments.set({
      contactEmail,
      supportServerInvite,
      privacyPolicy: typeof privacyPolicy === 'string' ? privacyPolicy : privacyPolicy?.content,
      termsOfService: typeof termsOfService === 'string' ? termsOfService : termsOfService?.content
    });

    logger.success('Discord Verification Legal Documents updated via Web Dashboard', 'LEGAL_API');
    return res.json({ success: true, message: 'Legal documents saved and published live!', documents: saved });
  } catch (err) {
    logger.error('Failed to update legal documents', err, 'LEGAL_API');
    return res.status(500).json({ success: false, error: 'Internal server error saving legal documents.' });
  }
});

router.post('/bot/legal/reset', requireAdminAuth, async (req, res) => {
  try {
    const { contactEmail, supportServerInvite } = req.body;
    const resetDocs = await db.legalDocuments.resetToDefault(contactEmail, supportServerInvite);

    logger.info('Reset legal documents to verification-ready defaults', 'LEGAL_API');
    return res.json({ success: true, message: 'Reset to verification-ready default templates!', documents: resetDocs });
  } catch (err) {
    logger.error('Failed to reset legal documents', err, 'LEGAL_API');
    return res.status(500).json({ success: false, error: 'Internal error resetting legal documents.' });
  }
});

// 15b. Staff & Community Applications API
router.post('/guilds/:guildId/applications/forms', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const {
      id,
      name,
      description,
      isOpen,
      title,
      color,
      buttonText,
      bannerUrl,
      reviewChannelId,
      questions,
      requiredRoleIds,
      blockedRoleIds,
      minAccountAgeDays,
      minServerDays,
      reapplyCooldownHours,
      acceptRoleIds,
      removeRoleIds,
      acceptDmTitle,
      acceptDmDesc,
      acceptDmColor,
      denyDmTitle,
      denyDmDesc,
      denyDmColor
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Application position title is required.' });
    }

    const formId = id || `form_${Date.now()}`;
    const saved = await db.applicationForms.save(formId, {
      guildId,
      name: name.trim(),
      description: description || '',
      isOpen: isOpen !== false && isOpen !== 'false',
      panelEmbed: {
        title: title || `🛡️ ${name.trim()}`,
        description: description || 'Click below to submit your application.',
        color: color || '#5865F2',
        buttonText: buttonText || 'Apply Now',
        bannerUrl: bannerUrl || ''
      },
      reviewChannelId: reviewChannelId || '',
      questions: typeof questions === 'string' ? JSON.parse(questions) : (questions || []),
      requiredRoleIds: Array.isArray(requiredRoleIds) ? requiredRoleIds : (requiredRoleIds ? [requiredRoleIds] : []),
      blockedRoleIds: Array.isArray(blockedRoleIds) ? blockedRoleIds : (blockedRoleIds ? [blockedRoleIds] : []),
      minAccountAgeDays: parseInt(minAccountAgeDays, 10) || 0,
      minServerDays: parseInt(minServerDays, 10) || 0,
      reapplyCooldownHours: parseInt(reapplyCooldownHours, 10) || 24,
      acceptRoleIds: Array.isArray(acceptRoleIds) ? acceptRoleIds : (acceptRoleIds ? [acceptRoleIds] : []),
      removeRoleIds: Array.isArray(removeRoleIds) ? removeRoleIds : (removeRoleIds ? [removeRoleIds] : []),
      acceptDmEmbed: {
        title: acceptDmTitle || '🎉 Application Accepted!',
        description: acceptDmDesc || 'Congratulations! Your application has been accepted.',
        color: acceptDmColor || '#57F287'
      },
      denyDmEmbed: {
        title: denyDmTitle || 'Application Update',
        description: denyDmDesc || 'Thank you for your interest. Unfortunately your application was not accepted at this time.',
        color: denyDmColor || '#ED4245'
      }
    });

    return res.json({ success: true, message: 'Application form saved successfully!', form: saved });
  } catch (err) {
    logger.error('Failed to save application form', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to save application form.' });
  }
});

router.post('/guilds/:guildId/applications/forms/:formId/toggle', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const { guildId, formId } = req.params;
    const form = await db.applicationForms.get(formId);
    if (!form) return res.status(404).json({ success: false, error: 'Form not found.' });

    const newIsOpen = !form.isOpen;
    const updated = await db.applicationForms.save(formId, { isOpen: newIsOpen });

    // Live update published panel button if available
    if (form.panelChannelId && form.panelMessageId) {
      await updateApplicationPanelMessage(guildId, form.panelChannelId, form.panelMessageId, updated);
    }

    return res.json({ success: true, message: `Application status toggled to: ${newIsOpen ? 'OPEN' : 'CLOSED'}`, isOpen: newIsOpen });
  } catch (err) {
    logger.error('Failed to toggle application form status', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to toggle status.' });
  }
});

router.delete('/guilds/:guildId/applications/forms/:formId', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    await db.applicationForms.delete(req.params.formId);
    return res.json({ success: true, message: 'Application position deleted.' });
  } catch (err) {
    logger.error('Failed to delete application form', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to delete form.' });
  }
});

router.post('/guilds/:guildId/applications/publish-panel', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { formId, channelId } = req.body;

    if (!formId || !channelId) {
      return res.status(400).json({ success: false, error: 'Form ID and Channel ID are required.' });
    }

    const form = await db.applicationForms.get(formId);
    if (!form) return res.status(404).json({ success: false, error: 'Form configuration not found.' });

    const published = await publishApplicationPanel(guildId, channelId, form);

    await db.applicationForms.save(formId, {
      panelChannelId: channelId,
      panelMessageId: published.id
    });

    return res.json({ success: true, message: 'Application panel published live to Discord!', messageId: published.id });
  } catch (err) {
    logger.error('Failed to publish application panel to Discord', err, 'API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to post panel to Discord.' });
  }
});

router.post('/guilds/:guildId/applications/submissions/:subId/status', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const { guildId, subId } = req.params;
    const { status, note } = req.body;

    if (!['accepted', 'denied'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be accepted or denied.' });
    }

    const submission = await db.applicationSubmissions.get(subId);
    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });

    const form = await db.applicationForms.get(submission.formId);
    const client = getClientForGuild(guildId);
    const guild = client?.guilds?.cache?.get(guildId);
    const applicantMember = guild ? await guild.members.fetch(submission.applicantId).catch(() => null) : null;

    if (status === 'accepted') {
      if (applicantMember && form) {
        if (Array.isArray(form.acceptRoleIds)) {
          for (const roleId of form.acceptRoleIds) {
            if (guild.roles.cache.has(roleId)) await applicantMember.roles.add(roleId).catch(() => {});
          }
        }
        if (Array.isArray(form.removeRoleIds)) {
          for (const roleId of form.removeRoleIds) {
            if (guild.roles.cache.has(roleId)) await applicantMember.roles.remove(roleId).catch(() => {});
          }
        }
      }

      if (applicantMember) {
        try {
          const { EmbedBuilder } = require('discord.js');
          const dmCfg = form?.acceptDmEmbed || {};
          const dmEmbed = new EmbedBuilder()
            .setTitle(dmCfg.title || '🎉 Application Accepted!')
            .setColor(dmCfg.color || '#57F287')
            .setDescription(`${dmCfg.description || 'Congratulations! Your application has been accepted.'}\n\n**Note from Staff:**\n> ${note || 'Welcome to the team!'}`)
            .setTimestamp();
          await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}
      }
    } else {
      if (applicantMember) {
        try {
          const { EmbedBuilder } = require('discord.js');
          const dmCfg = form?.denyDmEmbed || {};
          const dmEmbed = new EmbedBuilder()
            .setTitle(dmCfg.title || 'Application Update')
            .setColor(dmCfg.color || '#ED4245')
            .setDescription(`${dmCfg.description || 'Thank you for your interest. Unfortunately your application was not accepted at this time.'}\n\n**Reason:**\n> ${note || 'Rejected by staff.'}`)
            .setTimestamp();
          await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}
      }
    }

    await db.applicationSubmissions.update(subId, {
      status,
      reviewedBy: 'web_admin',
      reviewedByTag: 'Dashboard Admin',
      reviewNote: note || '',
      reviewedAt: Date.now()
    });

    return res.json({ success: true, message: `Submission marked as ${status.toUpperCase()}!` });
  } catch (err) {
    logger.error('Failed to update submission status', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to update submission status.' });
  }
});

router.delete('/guilds/:guildId/applications/submissions/:subId', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    await db.applicationSubmissions.delete(req.params.subId);
    return res.json({ success: true, message: 'Submission deleted.' });
  } catch (err) {
    logger.error('Failed to delete submission', err, 'API');
    return res.status(500).json({ success: false, error: 'Failed to delete submission.' });
  }
});

// 16. Multi-Bot Fleet Management API
router.get('/bots', requireAdminAuth, async (req, res) => {
  try {
    const list = await botManager.listBots();
    return res.json({ success: true, bots: list });
  } catch (err) {
    logger.error('Failed to list bots', err, 'BOT_API');
    return res.status(500).json({ success: false, error: 'Internal server error listing bots.' });
  }
});

router.post('/bots', requireAdminAuth, async (req, res) => {
  try {
    const { token, name } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Bot token is required.' });
    }

    const newBot = await botManager.addBot(token, name);
    return res.json({ success: true, message: 'Bot successfully connected and registered!', bot: newBot });
  } catch (err) {
    logger.error('Failed to add bot instance', err, 'BOT_API');
    return res.status(400).json({ success: false, error: err.message || 'Invalid bot token or failed to authenticate with Discord.' });
  }
});

router.post('/bots/:botId/start', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    await botManager.restartBot(botId);
    return res.json({ success: true, message: `Bot [${botId}] started successfully.` });
  } catch (err) {
    logger.error(`Failed to start bot ${req.params.botId}`, err, 'BOT_API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to start bot.' });
  }
});

router.post('/bots/:botId/stop', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    await botManager.stopBot(botId);
    return res.json({ success: true, message: `Bot [${botId}] stopped.` });
  } catch (err) {
    logger.error(`Failed to stop bot ${req.params.botId}`, err, 'BOT_API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to stop bot.' });
  }
});

router.post('/bots/:botId/restart', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    await botManager.restartBot(botId);
    return res.json({ success: true, message: `Bot [${botId}] restarted.` });
  } catch (err) {
    logger.error(`Failed to restart bot ${req.params.botId}`, err, 'BOT_API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to restart bot.' });
  }
});

router.delete('/bots/:botId', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    if (botId === 'primary') {
      return res.status(400).json({ success: false, error: 'Primary bot cannot be deleted.' });
    }
    await botManager.deleteBot(botId);
    return res.json({ success: true, message: `Bot [${botId}] removed.` });
  } catch (err) {
    logger.error(`Failed to delete bot ${req.params.botId}`, err, 'BOT_API');
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete bot.' });
  }
});

router.post('/bots/:botId/sync-commands', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    const result = await botManager.syncSlashCommands(botId);
    if (result.success) {
      return res.json({ success: true, message: `Successfully registered ${result.count} global application commands!`, count: result.count });
    } else {
      return res.status(500).json({ success: false, error: result.error || 'Failed to sync slash commands.' });
    }
  } catch (err) {
    logger.error(`Failed to sync slash commands for ${req.params.botId}`, err, 'BOT_API');
    return res.status(500).json({ success: false, error: err.message || 'Error syncing slash commands.' });
  }
});

// 17. Per-Guild Commands & Permissions Customization API
router.get('/guilds/:guildId/commands-config', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const config = await db.commandsConfig.get(guildId);
    return res.json({ success: true, config });
  } catch (err) {
    logger.error('Failed to get commands config', err, 'COMMANDS_API');
    return res.status(500).json({ success: false, error: 'Internal server error getting command configurations.' });
  }
});

router.post('/guilds/:guildId/commands-config', requireAdminAuth, canManageGuild, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { prefix, secondaryPrefixes, allowMentionPrefix, modules, commands } = req.body;

    const current = await db.commandsConfig.get(guildId);
    const updated = {
      ...current,
      prefix: typeof prefix === 'string' && prefix.trim() ? prefix.trim() : current.prefix,
      secondaryPrefixes: Array.isArray(secondaryPrefixes) 
        ? secondaryPrefixes 
        : (typeof secondaryPrefixes === 'string' ? secondaryPrefixes.split(/[,\s]+/).filter(Boolean) : current.secondaryPrefixes),
      allowMentionPrefix: typeof allowMentionPrefix === 'boolean' ? allowMentionPrefix : current.allowMentionPrefix,
      modules: typeof modules === 'object' && modules !== null ? { ...current.modules, ...modules } : current.modules,
      commands: typeof commands === 'object' && commands !== null ? { ...current.commands, ...commands } : current.commands
    };

    const saved = await db.commandsConfig.set(guildId, updated);
    return res.json({ success: true, message: 'Command and permission rules updated successfully!', config: saved });
  } catch (err) {
    logger.error('Failed to save commands config', err, 'COMMANDS_API');
    return res.status(500).json({ success: false, error: 'Internal server error saving command configurations.' });
  }
});

module.exports = router;
