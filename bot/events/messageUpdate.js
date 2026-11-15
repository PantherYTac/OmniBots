/**
 * Event: messageUpdate
 * Granular audit logging for edited messages with before/after diffs (Carl-bot style)
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');
const { computeDiff } = require('../../shared/utils/helpers');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const guildSettings = await db.guilds.get(newMessage.guild.id);
    if (!guildSettings.modules?.logging || !guildSettings.logging?.enabled) return;

    const logChanId = guildSettings.logging.splitChannels?.messageLogs || guildSettings.logging.logChannelId;
    if (!logChanId) return;

    const logChannel = newMessage.guild.channels.cache.get(logChanId);
    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#FFA500')
      .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
      .setDescription(`A message by ${newMessage.author} was edited in ${newMessage.channel} [Jump to Message](${newMessage.url})\n\n` +
        computeDiff(oldMessage.content || '*[Cached content unavailable]*', newMessage.content || '*[Empty content]*')
      )
      .setFooter({ text: `User ID: ${newMessage.author.id} • Message ID: ${newMessage.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    await db.auditLogs.log(newMessage.guild.id, 'MESSAGE_EDIT', `${newMessage.author.tag} edited message in #${newMessage.channel.name}`, {
      userId: newMessage.author.id,
      channelId: newMessage.channel.id,
      messageId: newMessage.id
    });
  }
};
