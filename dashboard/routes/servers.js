/**
 * Server Selector Route (Protected by requireAdminAuth)
 * Loads all servers where the Discord bot is a member directly via bot token / client cache
 */

const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { hasManageGuild } = require('../../shared/utils/helpers');
const { getBotGuilds } = require('../middleware/botClient');
const { db } = require('../../shared');

router.get('/', requireAdminAuth, async (req, res) => {
  // 1. Fetch all servers where the Discord bot is currently a member
  const botGuilds = await getBotGuilds();

  // 2. Check if admin linked personal Discord OAuth to show uninvited manageable servers
  const userGuilds = req.session.guilds || [];
  const combinedGuilds = [...botGuilds];

  if (userGuilds.length > 0) {
    for (const g of userGuilds) {
      if (hasManageGuild(g.permissions)) {
        if (!combinedGuilds.some(bg => bg.id === g.id)) {
          combinedGuilds.push({
            id: g.id,
            name: g.name,
            icon: g.icon,
            botInGuild: false
          });
        }
      }
    }
  }

  // Sort: Active bot guilds first
  combinedGuilds.sort((a, b) => (b.botInGuild ? 1 : 0) - (a.botInGuild ? 1 : 0));

  // Dynamic OAuth and Bot Client ID resolution
  const oauth = await db.oauthConfig.get();
  const bots = await db.managedBots.list();
  const primaryBotId = bots[0]?.botId || '';
  const effectiveClientId = oauth.clientId || primaryBotId || process.env.CLIENT_ID || '';
  const isLinked = !!(req.session.discordUser && req.session.discordUser.id);

  res.render('servers', {
    user: req.session.user,
    discordUser: req.session.discordUser || null,
    guilds: combinedGuilds,
    clientId: effectiveClientId,
    oauthConfig: oauth,
    isLinked
  });
});

module.exports = router;
