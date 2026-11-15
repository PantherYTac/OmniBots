/**
 * Community Command: /snipe
 * View the most recently deleted message in this channel
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Global in-memory Snipe store: Map<channelId, { content, authorTag, authorAvatar, timestamp, attachments }>
const snipeStore = new Map();

module.exports = {
  module: 'community',
  snipeStore,
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Reveal the most recently deleted message in this channel'),

  async execute(ctx) {
    const channelId = ctx.channel.id;
    const lastDeleted = snipeStore.get(channelId);

    if (!lastDeleted) {
      return ctx.reply({ content: '🔍 There are no recently deleted messages to snipe in this channel!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: lastDeleted.authorTag, iconURL: lastDeleted.authorAvatar })
      .setColor('#5865F2')
      .setDescription(lastDeleted.content || '*[Message contained no text or only attachments]*')
      .setFooter({ text: `Deleted in #${ctx.channel.name}` })
      .setTimestamp(lastDeleted.timestamp);

    if (lastDeleted.imageUrl) {
      embed.setImage(lastDeleted.imageUrl);
    }

    return ctx.reply({ embeds: [embed] });
  }
};