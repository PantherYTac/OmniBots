/**
 * Moderation Command: /tempban
 * Temporarily bans a member and automatically lifts the ban after a duration
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { parseDuration } = require('../../../shared/utils/helpers');

module.exports = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a member from the server')
    .addUserOption(opt => opt.setName('target').setDescription('The member to temporarily ban').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 12h, 3d, 7d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  async execute(ctx) {
    const targetUser = ctx.options.getUser('target');
    const durationStr = ctx.options.getString('duration') || '1d';
    const reason = ctx.options.getString('reason') || 'No reason provided';

    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a valid member to tempban.', ephemeral: true });
    }

    if (targetUser.id === ctx.user.id) {
      return ctx.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000) {
      return ctx.reply({ content: '❌ Invalid duration. Minimum duration is 1m (e.g. 30m, 2h, 1d, 7d).', ephemeral: true });
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && !member.bannable) {
      return ctx.reply({ content: '❌ Cannot ban this member. Their role is higher than mine or they are server owner.', ephemeral: true });
    }

    try {
      await ctx.guild.members.ban(targetUser.id, {
        reason: `[Tempban: ${durationStr}] ${reason} (by ${ctx.user.tag})`
      });

      await db.infractions.add({
        guildId: ctx.guild.id,
        userId: targetUser.id,
        moderatorId: ctx.user.id,
        type: 'tempban',
        reason: `[${durationStr}] ${reason}`
      });

      await db.modCases.create(ctx.guild.id, {
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        moderatorId: ctx.user.id,
        moderatorTag: ctx.user.tag,
        action: 'tempban',
        duration: durationStr,
        reason
      });

      // Schedule automated unban
      setTimeout(async () => {
        try {
          await ctx.guild.bans.remove(targetUser.id, `[Tempban Expired] Auto-unbanned after ${durationStr}`);
        } catch {}
      }, durationMs);

      const embed = new EmbedBuilder()
        .setTitle('⛔ Member Temporarily Banned')
        .setColor('#ED4245')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: ctx.user.tag, inline: true },
          { name: 'Duration', value: durationStr, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setFooter({ text: `Auto-unban will trigger in ${durationStr}` })
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    } catch (err) {
      return ctx.reply({ content: `❌ Failed to tempban: ${err.message}`, ephemeral: true });
    }
  }
};