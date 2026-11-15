/**
 * Moderation Commands: /lock and /unlock
 */

const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock down or unlock a channel for @everyone')
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Lock the channel so regular members cannot send messages')
        .addChannelOption(opt => opt.setName('target').setDescription('Channel to lock (defaults to current)').addChannelTypes(ChannelType.GuildText))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the lockdown'))
    )
    .addSubcommand(sub =>
      sub
        .setName('release')
        .setDescription('Unlock the channel to allow members to speak again')
        .addChannelOption(opt => opt.setName('target').setDescription('Channel to unlock (defaults to current)').addChannelTypes(ChannelType.GuildText))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetChannel = interaction.options.getChannel('target') || interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;

    if (sub === 'channel') {
      const reason = interaction.options.getString('reason') || 'Channel lockdown instituted by staff';

      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        AddReactions: false
      });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Channel Locked')
        .setColor('#ED4245')
        .setDescription(`This channel has been locked down by staff.\n**Reason:** ${reason}`)
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: `🔒 Successfully locked ${targetChannel}.`, ephemeral: true });
    }

    if (sub === 'release') {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null,
        AddReactions: null
      });

      const embed = new EmbedBuilder()
        .setTitle('🔓 Channel Unlocked')
        .setColor('#57F287')
        .setDescription('The lockdown has been lifted. Normal chat activity may resume.')
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: `🔓 Successfully unlocked ${targetChannel}.`, ephemeral: true });
    }
  }
};
