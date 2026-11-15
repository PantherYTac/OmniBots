/**
 * Event: guildMemberAdd
 * Autoroles, Sticky Roles restoration, Welcome messages, Audit logging
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');
const { trackMemberJoin } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guildSettings = await db.guilds.get(member.guild.id);

    // 0. Invite Tracking & Attribution Engine
    const inviteData = await trackMemberJoin(member);

    // 1. Autoroles
    try {
      const isBot = member.user.bot;
      const roleList = isBot
        ? (guildSettings.autoroles?.botRoles || [])
        : (guildSettings.autoroles?.memberRoles || []);

      for (const roleId of roleList) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role).catch(() => {});
      }
    } catch (err) {
      logger.error('Failed to assign autoroles', err, 'AUTOROLE');
    }

    // 2. Sticky Roles Restoration
    if (guildSettings.modules?.moderation && guildSettings.stickyRoles?.enabled) {
      try {
        const savedRoles = await db.stickyRoles.get(member.guild.id, member.id);
        if (Array.isArray(savedRoles) && savedRoles.length > 0) {
          for (const roleId of savedRoles) {
            const role = member.guild.roles.cache.get(roleId);
            if (role && !role.managed) {
              await member.roles.add(role).catch(() => {});
            }
          }
        }
      } catch (err) {
        logger.error('Failed to restore sticky roles', err, 'STICKY_ROLES');
      }
    }

    // 3. Welcome Message
    if (guildSettings.welcome?.enabled && guildSettings.welcome?.channelId) {
      try {
        const welcomeChan = member.guild.channels.cache.get(guildSettings.welcome.channelId);
        if (welcomeChan && welcomeChan.isTextBased()) {
          const rawText = guildSettings.welcome.message || 'Welcome {user} to **{server}**! You are member #{member_count}. 🎉';
          const inviterMention = inviteData?.inviterUser ? `<@${inviteData.inviterUser.id}>` : (inviteData?.isVanity ? 'Vanity URL' : 'Direct / Unknown');
          const inviterTag = inviteData?.inviterUser ? inviteData.inviterUser.tag : (inviteData?.isVanity ? 'Vanity URL' : 'Direct / Unknown');
          const inviterCount = inviteData?.netInvites != null ? inviteData.netInvites.toString() : '0';
          const inviteCodeStr = inviteData?.code || 'N/A';

          const text = rawText
            .replace(/\{user\}/g, `${member}`)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{member_count\}/g, member.guild.memberCount.toString())
            .replace(/\{inviter\}/g, inviterMention)
            .replace(/\{inviter\.tag\}/g, inviterTag)
            .replace(/\{inviter\.invites\}/g, inviterCount)
            .replace(/\{invite\.code\}/g, inviteCodeStr);

          if (guildSettings.welcome.sendCard) {
            const embed = new EmbedBuilder()
              .setTitle(`👋 Welcome to ${member.guild.name}!`)
              .setDescription(text)
              .setColor('#5865F2')
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: `Member #${member.guild.memberCount}` })
              .setTimestamp();

            await welcomeChan.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
          } else {
            await welcomeChan.send({ content: text }).catch(() => {});
          }
        }
      } catch (err) {
        logger.error('Failed to send welcome message', err, 'WELCOME');
      }
    }

    // 4. Audit Logging
    if (guildSettings.modules?.logging && guildSettings.logging?.enabled) {
      const logChanId = guildSettings.logging.splitChannels?.memberLogs || guildSettings.logging.logChannelId;
      if (logChanId) {
        const logChannel = member.guild.channels.cache.get(logChanId);
        if (logChannel && logChannel.isTextBased()) {
          const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
          const inviterDesc = inviteData?.inviterUser
            ? `<@${inviteData.inviterUser.id}> (\`${inviteData.inviterUser.tag}\`)`
            : (inviteData?.isVanity ? '🔗 Vanity URL' : '❓ Direct / Unknown');
          const fakeBadge = inviteData?.isFake ? ' ⚠️ *(New Account < 7d)*' : '';

          const embed = new EmbedBuilder()
            .setTitle('📥 Member Joined')
            .setColor('#57F287')
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setDescription(
              `${member} joined the server.\n\n` +
              `• **Account Created:** <t:${accountCreated}:R> (<t:${accountCreated}:f>)\n` +
              `• **Invited By:** ${inviterDesc}\n` +
              `• **Invite Code:** \`${inviteData?.code || 'N/A'}\`\n` +
              `• **Inviter Total Net:** ${inviteData?.netInvites ?? 0}${fakeBadge}\n` +
              `• **Member Count:** ${member.guild.memberCount}`
            )
            .setFooter({ text: `User ID: ${member.id}` })
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      await db.auditLogs.log(member.guild.id, 'MEMBER_JOIN', `${member.user.tag} joined the server`, {
        userId: member.id,
        createdTimestamp: member.user.createdTimestamp,
        inviterId: inviteData?.inviterUser?.id || (inviteData?.isVanity ? 'VANITY' : null),
        code: inviteData?.code,
        isFake: inviteData?.isFake
      });
    }
  }
};
