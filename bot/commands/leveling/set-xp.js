/**
 * Leveling Command: /set-xp
 * Admin command to set a member's XP or level
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { getLevel } = require('../../../shared/utils/helpers');

module.exports = {
  module: 'leveling',
  data: new SlashCommandBuilder()
    .setName('set-xp')
    .setDescription('Set a member\'s XP amount')
    .addUserOption(opt => opt.setName('target').setDescription('The member whose XP to adjust').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('New total XP amount').setMinValue(0).setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(ctx) {
    const targetUser = ctx.options.getUser('target');
    const amount = ctx.options.getInteger('amount');

    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a valid member.', ephemeral: true });
    }

    const current = await db.levels.get(ctx.guild.id, targetUser.id);
    const newLevel = getLevel(amount);

    current.xp = amount;
    current.level = newLevel;
    current.userName = targetUser.tag;
    current.avatarUrl = targetUser.displayAvatarURL({ size: 128 });

    await db.levels.save(ctx.guild.id, targetUser.id, current);

    const embed = new EmbedBuilder()
      .setTitle('⭐ XP Updated')
      .setColor('#5865F2')
      .setDescription(`Successfully updated XP for **${targetUser.tag}**.`)
      .addFields(
        { name: 'Total XP', value: amount.toLocaleString(), inline: true },
        { name: 'Calculated Level', value: `Level ${newLevel}`, inline: true },
        { name: 'Updated By', value: ctx.user.tag, inline: true }
      )
      .setTimestamp();

    return ctx.reply({ embeds: [embed] });
  }
};