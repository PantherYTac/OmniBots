/**
 * Community Command: /starboard
 * Configure and view starboard status
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  module: 'community',
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure or view Starboard settings')
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current Starboard configuration')
    )
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Configure the Starboard channel and reaction threshold')
        .addChannelOption(opt => opt.setName('channel').setDescription('Starboard channel').setRequired(true))
        .addIntegerOption(opt => opt.setName('threshold').setDescription('Star reaction count needed (default 3)').setMinValue(1).setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand() || 'status';
    const settings = await db.guilds.get(ctx.guild.id);
    const starCfg = settings.starboard || { enabled: false, channelId: '', threshold: 3 };

    if (sub === 'status') {
      const channelMention = starCfg.channelId ? `<#${starCfg.channelId}>` : 'Not Configured';
      const embed = new EmbedBuilder()
        .setTitle('⭐ Starboard Configuration')
        .setColor('#FEE75C')
        .addFields(
          { name: 'Status', value: starCfg.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Channel', value: channelMention, inline: true },
          { name: 'Threshold', value: `${starCfg.threshold || 3} ⭐ reactions`, inline: true }
        )
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    }

    if (sub === 'set') {
      const channel = ctx.options.getChannel('channel');
      const threshold = ctx.options.getInteger('threshold') || 3;

      if (!channel) {
        return ctx.reply({ content: '❌ Please select a valid channel.', ephemeral: true });
      }

      const updated = {
        enabled: true,
        channelId: channel.id,
        threshold
      };

      await db.guilds.update(ctx.guild.id, { starboard: updated });

      const embed = new EmbedBuilder()
        .setTitle('⭐ Starboard Configured')
        .setColor('#57F287')
        .setDescription(`Starboard has been enabled and linked to ${channel}.`)
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Threshold', value: `${threshold} ⭐ stars`, inline: true }
        )
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    }
  }
};