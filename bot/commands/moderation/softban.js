/**
 * Moderation Command: /softban
 * Bans and immediately unbans a member to purge their messages without a permanent ban
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Softban a member (ban and instant unban to purge messages)')
    .addUserOption(opt => opt.setName('target').setDescription('The member to softban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the softban').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Days of messages to delete (1-7, default 7)')
        .setMinValue(1)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  async execute(ctx) {
    const targetUser = ctx.options.getUser('target');
    const reason = ctx.options.getString('reason') || 'No reason provided';
    const deleteDays = ctx.options.getInteger('delete_days') || 7;

    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a valid member to softban.', ephemeral: true });
    }

    if (targetUser.id === ctx.user.id) {
      return ctx.reply({ content: '❌ You cannot softban yourself.', ephemeral: true });
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && !member.bannable) {
      return ctx.reply({ content: '❌ Cannot softban this user. Their highest role exceeds mine or they are server owner.', ephemeral: true });
    }

    try {
      // 1. Ban with deleteMessageSeconds
      await ctx.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        reason: `[Softban] ${reason} (by ${ctx.user.tag})`
      });

      // 2. Immediate Unban
      await ctx.guild.bans.remove(targetUser.id, `[Softban Auto-Unban] ${reason}`);

      // 3. Log Infraction & Mod Case
      await db.infractions.add({
        guildId: ctx.guild.id,
        userId: targetUser.id,
        moderatorId: ctx.user.id,
        type: 'softban',
        reason
      });

      await db.modCases.create(ctx.guild.id, {
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        moderatorId: ctx.user.id,
        moderatorTag: ctx.user.tag,
        action: 'softban',
        reason
      });

      const embed = new EmbedBuilder()
        .setTitle('🧹 Member Softbanned')
        .setColor('#FFA500')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: ctx.user.tag, inline: true },
          { name: 'Purged Messages', value: `${deleteDays} days`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setFooter({ text: 'Softban complete • Member may rejoin immediately' })
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    } catch (err) {
      return ctx.reply({ content: `❌ Failed to softban member: ${err.message}`, ephemeral: true });
    }
  }
};