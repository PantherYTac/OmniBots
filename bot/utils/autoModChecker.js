/**
 * Auto-Moderation Engine & Punishment Dispatcher (Carl-bot style)
 */

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');
const { parseDuration } = require('../../shared/utils/helpers');

// In-memory sliding window for anti-spam flood tracking
// Map<userId_guildId, [timestamps]>
const messageTracker = new Map();

/**
 * Checks a message against guild auto-moderation rules
 * Returns true if the message was violated & handled (should stop further processing)
 */
async function checkMessage(message) {
  if (!message.guild || message.author.bot) return false;

  const guildSettings = await db.guilds.get(message.guild.id);
  if (!guildSettings.modules?.automod) return false;

  const automod = guildSettings.automod || {};

  // Bypass Admins and Manage Messages members
  if (
    message.member?.permissions.has(PermissionsBitField.Flags.Administrator) ||
    message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)
  ) {
    return false;
  }

  // Check Ignored Channels
  if (automod.ignoredChannels && automod.ignoredChannels.includes(message.channel.id)) {
    return false;
  }

  // Check Ignored Roles
  if (automod.ignoredRoles && message.member?.roles.cache.some(r => automod.ignoredRoles.includes(r.id))) {
    return false;
  }

  const content = message.content || '';
  let violation = null;

  // 1. Check Anti-Invites
  if (automod.antiInvites) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[a-zA-Z0-9]+/i;
    if (inviteRegex.test(content)) {
      violation = { type: 'invite', reason: 'Posting Discord Server Invite' };
    }
  }

  // 2. Check Anti-Links
  if (!violation && automod.antiLinks) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(content)) {
      violation = { type: 'link', reason: 'Posting Unauthorized External Link' };
    }
  }

  // 3. Check Banned Words
  if (!violation && Array.isArray(automod.bannedWords) && automod.bannedWords.length > 0) {
    const lower = content.toLowerCase();
    for (const word of automod.bannedWords) {
      if (word.trim() && lower.includes(word.trim().toLowerCase())) {
        violation = { type: 'banned_word', reason: `Used Prohibited Keyword: "${word.trim()}"` };
        break;
      }
    }
  }

  // 4. Check Mass Mentions
  if (!violation && automod.antiMassMentions) {
    const threshold = automod.mentionThreshold || 5;
    const mentionsCount = (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);
    if (mentionsCount >= threshold) {
      violation = { type: 'mass_mention', reason: `Mass Mentions (${mentionsCount} mentions >= limit ${threshold})` };
    }
  }

  // 5. Check Emoji Spam
  if (!violation && automod.antiEmojiSpam) {
    const threshold = automod.emojiThreshold || 8;
    const customEmojis = (content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    const unicodeEmojis = (content.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu) || []).length;
    const totalEmojis = customEmojis + unicodeEmojis;
    if (totalEmojis >= threshold) {
      violation = { type: 'emoji_spam', reason: `Emoji Spam (${totalEmojis} emojis >= limit ${threshold})` };
    }
  }

  // 6. Check Anti-Spam Flood
  if (!violation && automod.antiSpam) {
    const key = `${message.author.id}_${message.guild.id}`;
    const now = Date.now();
    const timestamps = messageTracker.get(key) || [];
    const windowStart = now - 4000; // 4 second window

    const recent = timestamps.filter(t => t > windowStart);
    recent.push(now);
    messageTracker.set(key, recent);

    if (recent.length >= 5) {
      violation = { type: 'spam_flood', reason: 'Rapid Message Flooding / Spam' };
      messageTracker.delete(key);
    }
  }

  // If no violation detected, message is clean
  if (!violation) return false;

  // Execute Punishment
  try {
    // 1. Delete offending message
    if (message.deletable) {
      await message.delete().catch(() => {});
    }

    const punishment = automod.punishment || 'delete_warn';

    // 2. Warn and auto-escalate
    if (punishment.includes('warn') || punishment.includes('timeout')) {
      const inf = await db.infractions.add({
        guildId: message.guild.id,
        userId: message.author.id,
        moderatorId: message.client.user.id,
        type: 'warn',
        reason: `[AutoMod] ${violation.reason}`
      });

      const totalWarns = await db.infractions.count(message.guild.id, message.author.id, 'warn');

      // Check auto-escalation thresholds
      let escalatedAction = null;
      const escalations = (automod.escalation || []).sort((a, b) => b.warns - a.warns);

      for (const rule of escalations) {
        if (totalWarns >= rule.warns) {
          escalatedAction = rule;
          break;
        }
      }

      let extraPunishmentText = '';
      if (escalatedAction && message.member?.moderatable) {
        if (escalatedAction.action === 'timeout') {
          const ms = parseDuration(escalatedAction.duration || '1h');
          await message.member.timeout(ms, `AutoMod Escalation: Reached ${totalWarns} warnings`);
          extraPunishmentText = `\n🔒 **Auto-Escalation:** Timed out for ${escalatedAction.duration || '1h'}.`;
        } else if (escalatedAction.action === 'kick') {
          await message.member.kick(`AutoMod Escalation: Reached ${totalWarns} warnings`);
          extraPunishmentText = `\n🚪 **Auto-Escalation:** Member kicked from server.`;
        } else if (escalatedAction.action === 'ban') {
          await message.member.ban({ reason: `AutoMod Escalation: Reached ${totalWarns} warnings` });
          extraPunishmentText = `\n⛔ **Auto-Escalation:** Member banned from server.`;
        }
      }

      // Send ephemeral warning notification in channel
      const alertMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`⚠️ ${message.author}, your message was removed by **Auto-Mod**.\n**Reason:** ${violation.reason} (Warning #${totalWarns})${extraPunishmentText}`)
        ]
      }).catch(() => null);

      if (alertMsg) {
        setTimeout(() => alertMsg.delete().catch(() => {}), 7000);
      }
    }

    // 3. Log to Audit Log Channel
    const logChannelId = guildSettings.logging?.splitChannels?.modLogs || guildSettings.logging?.logChannelId;
    if (logChannelId) {
      const logChan = message.guild.channels.cache.get(logChannelId);
      if (logChan && logChan.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Rule Triggered')
          .setColor('#ED4245')
          .addFields(
            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Reason', value: violation.reason, inline: false },
            { name: 'Filtered Message Snippet', value: content.substring(0, 500) || '*[No content]*', inline: false }
          )
          .setTimestamp();

        logChan.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    // Record in DB audit logs
    await db.auditLogs.log(message.guild.id, 'AUTOMOD_TRIGGER', `${message.author.tag} triggered AutoMod: ${violation.reason}`, {
      userId: message.author.id,
      channelId: message.channel.id,
      violation
    });

  } catch (err) {
    logger.error('Error executing AutoMod punishment', err, 'AUTOMOD');
  }

  return true;
}

module.exports = { checkMessage };
