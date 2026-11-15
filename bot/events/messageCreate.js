/**
 * Event: messageCreate
 * Automod, counting validator, custom commands, text XP, sticky messages
 */

const { checkMessage } = require('../utils/autoModChecker');
const { handlePrefixCommand } = require('../handlers/commandRouter');
const { afkStore } = require('../commands/community/afk');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

// Text XP Cooldown Map: Map<userId_guildId, timestamp>
const xpCooldowns = new Map();

// Sticky messages tracker: Map<channelId, lastStickyMessageId>
const stickyTracker = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    // AFK Check 1: If author was AFK, remove status upon sending message
    const authorAfkKey = `${message.guild.id}_${message.author.id}`;
    if (afkStore && afkStore.has(authorAfkKey)) {
      afkStore.delete(authorAfkKey);
      message.reply({ content: `👋 Welcome back ${message.author}, I have removed your AFK status!` })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(() => {});
    }

    // AFK Check 2: If message mentions an AFK user, notify author
    if (afkStore && message.mentions.users.size > 0) {
      for (const [userId, user] of message.mentions.users) {
        const targetAfkKey = `${message.guild.id}_${userId}`;
        if (afkStore.has(targetAfkKey)) {
          const afkData = afkStore.get(targetAfkKey);
          const minutesAgo = Math.floor((Date.now() - afkData.timestamp) / 60000);
          const timeStr = minutesAgo > 0 ? `${minutesAgo}m ago` : 'just now';
          message.reply({ content: `💤 **${user.tag}** is currently AFK: *${afkData.reason}* (${timeStr})` })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 7000))
            .catch(() => {});
          break; // Avoid spamming multiple AFK notices per message
        }
      }
    }

    // 1. Run Auto-Moderation Filter
    const wasViolated = await checkMessage(message);
    if (wasViolated) return;

    // 2. Handle Prefix Commands with Unified Dual-Runner
    const wasCommand = await handlePrefixCommand(message, client);
    if (wasCommand) return;

    const guildSettings = await db.guilds.get(message.guild.id);

    // 2. Counting Channel Validator
    if (guildSettings.modules?.counting && guildSettings.counting?.enabled) {
      if (message.channel.id === guildSettings.counting.channelId) {
        const expected = (guildSettings.counting.currentNumber || 0) + 1;
        const parsed = parseInt(message.content.trim(), 10);

        // Disallow same user counting twice in a row
        if (parsed === expected && message.author.id !== guildSettings.counting.lastUserId) {
          guildSettings.counting.currentNumber = expected;
          guildSettings.counting.lastUserId = message.author.id;
          await db.guilds.set(message.guild.id, guildSettings);
          await message.react('✅').catch(() => {});
        } else {
          // Wrong number or same user
          await message.delete().catch(() => {});
          const warn = await message.channel.send({
            content: `❌ ${message.author}, wrong count! The next number was **${expected}** (and you cannot count twice in a row).`
          }).catch(() => null);
          if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }
    }

    // 3. Custom Commands
    const firstWord = message.content.trim().split(/\s+/)[0];
    const custom = await db.customCommands.get(message.guild.id, firstWord);
    if (custom) {
      await message.channel.send({ content: custom.response }).catch(() => {});
    }

    // 4. Text XP Leveling System
    if (guildSettings.modules?.leveling && guildSettings.leveling?.enabled) {
      const cooldownKey = `${message.author.id}_${message.guild.id}`;
      const lastXp = xpCooldowns.get(cooldownKey) || 0;
      const now = Date.now();

      if (now - lastXp >= 60 * 1000) { // 60s cooldown
        xpCooldowns.set(cooldownKey, now);

        const rate = guildSettings.leveling.xpRate || 1.0;
        const xpGain = Math.floor((Math.random() * (25 - 15 + 1) + 15) * rate);

        const res = await db.levels.addXp(message.guild.id, message.author.id, xpGain);

        if (res.leveledUp) {
          // Automatic Level Role Rewards
          const levelRoles = guildSettings.leveling.levelRoles || [];
          for (const lr of levelRoles) {
            if (res.newLevel >= lr.level && !message.member.roles.cache.has(lr.roleId)) {
              const role = message.guild.roles.cache.get(lr.roleId);
              if (role) await message.member.roles.add(role).catch(() => {});
            }
          }

          // Level up announcement
          const announceChanId = guildSettings.leveling.announcementChannelId;
          const targetChan = announceChanId ? message.guild.channels.cache.get(announceChanId) : message.channel;

          if (targetChan && targetChan.isTextBased()) {
            const rawMsg = guildSettings.leveling.message || 'Congratulations {user}, you leveled up to **Level {level}**! 🚀';
            const text = rawMsg.replace(/\{user\}/g, `${message.author}`).replace(/\{level\}/g, `${res.newLevel}`);
            targetChan.send({ content: text }).catch(() => {});
          }
        }
      }
    }

    // 5. Sticky Messages
    if (guildSettings.stickyMessages && guildSettings.stickyMessages[message.channel.id]) {
      const stickyContent = guildSettings.stickyMessages[message.channel.id];
      const lastMsgId = stickyTracker.get(message.channel.id);

      if (lastMsgId) {
        const oldSticky = await message.channel.messages.fetch(lastMsgId).catch(() => null);
        if (oldSticky) await oldSticky.delete().catch(() => {});
      }

      const newSticky = await message.channel.send({ content: stickyContent }).catch(() => null);
      if (newSticky) stickyTracker.set(message.channel.id, newSticky.id);
    }
  }
};
