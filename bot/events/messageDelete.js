/**
 * Event: messageDelete
 * Granular audit logging for deleted messages
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');
const { truncate } = require('../../shared/utils/helpers');
const { snipeStore } = require('../commands/community/snipe');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;

    // Cache message for /snipe command
    if (snipeStore && message.channel) {
      snipeStore.set(message.channel.id, {
        content: message.content,
        authorTag: message.author?.tag || 'Unknown Member',
        authorAvatar: message.author?.displayAvatarURL?.() || null,
        imageUrl: message.attachments?.first?.()?.url || null,
        timestamp: Date.now()
      });
    }

    const guildSettings = await db.guilds.get(message.guild.id);
    if (!guildSettings.modules?.logging || !guildSettings.logging?.enabled) return;

    const logChanId = guildSettings.logging.splitChannels?.messageLogs || guildSettings.logging.logChannelId;
    if (!logChanId) return;

    const logChannel = message.guild.channels.cache.get(logChanId);
    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor('#ED4245')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(`A message by ${message.author} was deleted in ${message.channel}\n\n**Deleted Content:**\n${truncate(message.content || '*[Embed or attachment only]*', 1000)}`)
      .setFooter({ text: `User ID: ${message.author.id} • Message ID: ${message.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    await db.auditLogs.log(message.guild.id, 'MESSAGE_DELETE', `Message by ${message.author.tag} deleted in #${message.channel.name}`, {
      userId: message.author.id,
      channelId: message.channel.id,
      messageId: message.id
    });
  }
};
