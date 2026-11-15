/**
 * Leveling Command: /reset-xp
 * Admin command to reset a member's XP and Level to 0
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  module: 'leveling',
  data: new SlashCommandBuilder()
    .setName('reset-xp')
    .setDescription('Reset a member\'s XP and Level back to 0')
    .addUserOption(opt => opt.setName('target').setDescription('The member to reset').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(ctx) {
    const targetUser = ctx.options.getUser('target');

    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a valid member.', ephemeral: true });
    }

    const current = await db.levels.get(ctx.guild.id, targetUser.id);
    current.xp = 0;
    current.level = 0;
    current.messages = 0;
    current.voiceMinutes = 0;

    await db.levels.save(ctx.guild.id, targetUser.id, current);

    const embed = new EmbedBuilder()
      .setTitle('🔄 XP Reset')
      .setColor('#ED4245')
      .setDescription(`XP and Level progress for **${targetUser.tag}** have been reset to zero by ${ctx.user}.`)
      .setTimestamp();

    return ctx.reply({ embeds: [embed] });
  }
};