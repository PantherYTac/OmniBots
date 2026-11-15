/**
 * REST API Endpoints for Dashboard UI Actions
 */

const express = require('express');
const router = express.Router();
const { requireAdminAuth, canManageGuild } = require('../middleware/auth');
const { db } = require('../../shared');
const { publishReactionPanel, sendEmbedAnnouncement, getInProcessClient } = require('../middleware/botClient');
const { applySettings } = require('../../bot/utils/presenceManager');
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

    const inviteTracking = {
      ...(current.inviteTracking || {}),
      enabled,
      minAccountAgeDays,
      subtractLeaves
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

module.exports = router;
