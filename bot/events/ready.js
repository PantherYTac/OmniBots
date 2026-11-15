/**
 * Event: ready
 * Bot startup initialization, voice XP interval, stat channels updater
 */

const { ActivityType } = require('discord.js');
const logger = require('../../shared/utils/logger');
const { db } = require('../../shared');
const { initPresenceManager } = require('../utils/presenceManager');
const { initInvitesCache } = require('../utils/inviteTracker');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`, 'BOT');
    logger.info(`Serving ${client.guilds.cache.size} guilds and ${client.users.cache.size} cached users.`, 'BOT');

    // 1. Initialize Bot Presence Manager & Live Sync
    await initPresenceManager(client);

    // 2. Initialize Invite Tracking Cache
    await initInvitesCache(client);

    // 3. Voice XP Interval (every 60 seconds)
    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          const settings = await db.guilds.get(guild.id);
          if (!settings.modules?.leveling || !settings.leveling?.enabled) continue;

          for (const voiceState of guild.voiceStates.cache.values()) {
            if (!voiceState.member || voiceState.member.user.bot) continue;
            // Only reward if not self/server deafened and not in AFK channel
            if (voiceState.deaf || voiceState.selfDeaf || voiceState.channelId === guild.afkChannelId) continue;

            const res = await db.levels.addVoiceMinutes(guild.id, voiceState.member.id, 1, 10);
            if (res.leveledUp) {
              handleLevelUp(guild, voiceState.member, res.newLevel, settings);
            }
          }
        }
      } catch (err) {
        logger.error('Error in Voice XP routine', err, 'VOICE_XP');
      }
    }, 60 * 1000);

    // 2. Server Stat Voice Channels Updater (every 10 minutes)
    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          const settings = await db.guilds.get(guild.id);
          if (!settings.statChannels?.enabled) continue;

          const memberChanId = settings.statChannels.memberCountChannelId;
          if (memberChanId) {
            const chan = guild.channels.cache.get(memberChanId);
            if (chan) {
              const name = `👥 Members: ${guild.memberCount.toLocaleString()}`;
              if (chan.name !== name) await chan.setName(name).catch(() => {});
            }
          }
        }
      } catch (err) {
        logger.error('Error updating stat channels', err, 'STATS');
      }
    }, 10 * 60 * 1000);
  }
};

async function handleLevelUp(guild, member, newLevel, settings) {
  // Check and grant level roles
  const levelRoles = settings.leveling?.levelRoles || [];
  for (const lr of levelRoles) {
    if (newLevel >= lr.level && !member.roles.cache.has(lr.roleId)) {
      const role = guild.roles.cache.get(lr.roleId);
      if (role) await member.roles.add(role).catch(() => {});
    }
  }

  // Announcement message
  const announceChanId = settings.leveling?.announcementChannelId;
  const targetChannel = announceChanId ? guild.channels.cache.get(announceChanId) : null;

  if (targetChannel && targetChannel.isTextBased()) {
    const rawMsg = settings.leveling.message || 'Congratulations {user}, you reached **Level {level}**! 🎉';
    const msg = rawMsg.replace(/\{user\}/g, `${member}`).replace(/\{level\}/g, `${newLevel}`);
    targetChannel.send({ content: msg }).catch(() => {});
  }
}
