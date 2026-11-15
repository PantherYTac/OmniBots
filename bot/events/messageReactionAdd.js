/**
 * Event: messageReactionAdd
 * Starboard & reaction interactions
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;

    // Fetch partials if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        return;
      }
    }

    const message = reaction.message;
    if (!message.guild) return;

    const guildSettings = await db.guilds.get(message.guild.id);
    if (!guildSettings.modules?.starboard || !guildSettings.starboard?.enabled) return;

    const starEmoji = guildSettings.starboard.emoji || '⭐';
    if (reaction.emoji.name !== starEmoji) return;

    const threshold = guildSettings.starboard.threshold || 3;
    const count = reaction.count;

    if (count < threshold) return;

    const starboardChanId = guildSettings.starboard.channelId;
    if (!starboardChanId) return;

    const starboardChannel = message.guild.channels.cache.get(starboardChanId);
    if (!starboardChannel || !starboardChannel.isTextBased()) return;

    // Check if already posted to starboard
    const existing = await db.starboard.get(message.id);

    const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(`${message.content || ''}\n\n[**Jump to Message**](${message.url})`)
      .setColor('#FEE75C')
      .setFooter({ text: `Message ID: ${message.id}` })
      .setTimestamp(message.createdAt);

    // If message had an image attachment, embed it
    const imageAttachment = message.attachments.find(att => att.contentType && att.contentType.startsWith('image/'));
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    const starText = `${starEmoji} **${count}** | ${message.channel}`;

    if (existing && existing.starboardMessageId) {
      // Update existing starboard message
      const existingMsg = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ content: starText, embeds: [embed] });
        await db.starboard.set(message.id, { ...existing, stars: count });
        return;
      }
    }

    // Post fresh starboard message
    const starMsg = await starboardChannel.send({ content: starText, embeds: [embed] });
    await db.starboard.set(message.id, {
      originalMessageId: message.id,
      starboardMessageId: starMsg.id,
      channelId: message.channel.id,
      stars: count
    });
  }
};
