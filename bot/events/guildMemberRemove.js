/**
 * Event: guildMemberRemove
 * Sticky Roles saving, farewell messages, audit logging
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');
const { trackMemberLeave } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const guildSettings = await db.guilds.get(member.guild.id);

    // 0. Attribute member leave to original inviter
    const leaveData = await trackMemberLeave(member);
    await db.inviteMembers.remove(member.guild.id, member.id);

    // 1. Save Sticky Roles
    if (guildSettings.modules?.moderation && guildSettings.stickyRoles?.enabled) {
      try {
        const rolesToSave = member.roles.cache
          .filter(r => r.id !== member.guild.id && !r.managed)
          .map(r => r.id);

        if (rolesToSave.length > 0) {
          await db.stickyRoles.set(member.guild.id, member.id, rolesToSave);
        }
      } catch (err) {
        logger.error('Failed to save sticky roles', err, 'STICKY_ROLES');
      }
    }

    // 2. Farewell Message
    if (guildSettings.farewell?.enabled && guildSettings.farewell?.channelId) {
      try {
        const leaveChan = member.guild.channels.cache.get(guildSettings.farewell.channelId);
        if (leaveChan && leaveChan.isTextBased()) {
          const rawText = guildSettings.farewell.message || '{user} has left the server. Goodbye! 👋';
          const text = rawText
            .replace(/\{user\}/g, `**${member.user.tag}**`)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{member_count\}/g, member.guild.memberCount.toString());

          await leaveChan.send({ content: text }).catch(() => {});
        }
      } catch (err) {
        logger.error('Failed to send farewell message', err, 'FAREWELL');
      }
    }

    // 3. Audit Logging
    if (guildSettings.modules?.logging && guildSettings.logging?.enabled) {
      const logChanId = guildSettings.logging.splitChannels?.memberLogs || guildSettings.logging.logChannelId;
      if (logChanId) {
        const logChannel = member.guild.channels.cache.get(logChanId);
        if (logChannel && logChannel.isTextBased()) {
          const joinedAt = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
          const inviterNote = leaveData?.inviterId ? `\n• **Originally Invited By:** <@${leaveData.inviterId}> (leaves count incremented)` : '';
          const embed = new EmbedBuilder()
            .setTitle('📤 Member Left')
            .setColor('#ED4245')
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setDescription(`${member.user.tag} left the server.\n\n• **Joined:** ${joinedAt}\n• **Remaining Members:** ${member.guild.memberCount}${inviterNote}`)
            .setFooter({ text: `User ID: ${member.id}` })
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      await db.auditLogs.log(member.guild.id, 'MEMBER_LEAVE', `${member.user.tag} left the server`, {
        userId: member.id,
        inviterId: leaveData?.inviterId || null
      });
    }
  }
};
