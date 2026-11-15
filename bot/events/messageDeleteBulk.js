/**
 * Event: messageDeleteBulk
 * Granular audit logging for bulk purged messages
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');

module.exports = {
  name: 'messageDeleteBulk',
  async execute(messages, channel, client) {
    if (!channel.guild) return;

    const guildSettings = await db.guilds.get(channel.guild.id);
    if (!guildSettings.modules?.logging || !guildSettings.logging?.enabled) return;

    const logChanId = guildSettings.logging.splitChannels?.messageLogs || guildSettings.logging.logChannelId;
    if (!logChanId) return;

    const logChannel = channel.guild.channels.cache.get(logChanId);
    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('🧹 Bulk Messages Purged')
      .setColor('#ED4245')
      .setDescription(`**${messages.size} messages** were purged in ${channel}.`)
      .setFooter({ text: `Channel ID: ${channel.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    await db.auditLogs.log(channel.guild.id, 'BULK_DELETE', `${messages.size} messages purged in #${channel.name}`, {
      channelId: channel.id,
      count: messages.size
    });
  }
};
