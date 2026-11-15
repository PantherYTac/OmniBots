/**
 * Moderation Command: /nuke
 * Clones the current channel, purges all messages, and deletes the original
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Recreate and completely purge all message history from this channel')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(ctx) {
    const channel = ctx.channel;

    if (!channel || !channel.isTextBased() || !channel.clone) {
      return ctx.reply({ content: '❌ Cannot nuke this type of channel.', ephemeral: true });
    }

    try {
      await ctx.reply({ content: '💣 Nuking channel in progress...' });

      const position = channel.position;
      const newChannel = await channel.clone({
        name: channel.name,
        topic: channel.topic,
        nsfw: channel.nsfw,
        parent: channel.parentId,
        permissionOverwrites: channel.permissionOverwrites.cache,
        reason: `Nuked by ${ctx.user.tag}`
      });

      await channel.delete(`Nuked by ${ctx.user.tag}`);
      await newChannel.setPosition(position);

      const embed = new EmbedBuilder()
        .setTitle('💥 Channel Nuked')
        .setColor('#5865F2')
        .setDescription(`This channel has been nuked and purged clean by ${ctx.user}.`)
        .setImage('https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif')
        .setTimestamp();

      return newChannel.send({ embeds: [embed] });
    } catch (err) {
      return ctx.reply({ content: `❌ Failed to nuke channel: ${err.message}`, ephemeral: true });
    }
  }
};