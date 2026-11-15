/**
 * Moderation Command: /slowmode
 */

const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode cooldown for a text channel')
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown duration in seconds (0 to disable, max 21600 / 6h)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to configure (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    await targetChannel.setRateLimitPerUser(seconds);

    if (seconds === 0) {
      return interaction.reply({ content: `✅ Slowmode disabled in ${targetChannel}.` });
    } else {
      return interaction.reply({ content: `⏱️ Slowmode set to **${seconds}s** per message in ${targetChannel}.` });
    }
  }
};
