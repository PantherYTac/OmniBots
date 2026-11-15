/**
 * Event: guildMemberUpdate
 * Audit logging for roles and nickname changes
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const guildSettings = await db.guilds.get(newMember.guild.id);
    if (!guildSettings.modules?.logging || !guildSettings.logging?.enabled) return;

    const logChanId = guildSettings.logging.splitChannels?.memberLogs || guildSettings.logging.logChannelId;
    if (!logChanId) return;

    const logChannel = newMember.guild.channels.cache.get(logChanId);
    if (!logChannel || !logChannel.isTextBased()) return;

    // 1. Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setTitle('✏️ Nickname Changed')
        .setColor('#5865F2')
        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
        .addFields(
          { name: 'Before', value: oldMember.nickname || '*None (Username)*', inline: true },
          { name: 'After', value: newMember.nickname || '*None (Username)*', inline: true }
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 2. Roles change
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Member Roles Updated')
        .setColor('#5865F2')
        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      if (addedRoles.size > 0) {
        embed.addFields({ name: '➕ Roles Added', value: addedRoles.map(r => `${r}`).join(', ') });
      }
      if (removedRoles.size > 0) {
        embed.addFields({ name: '➖ Roles Removed', value: removedRoles.map(r => `${r}`).join(', ') });
      }

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }
};
