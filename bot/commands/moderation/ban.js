/**
 * Moderation Commands: /ban and /unban
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server or unban a user by ID')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Ban a member from the server')
        .addUserOption(opt => opt.setName('target').setDescription('The member to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
        .addIntegerOption(opt =>
          opt.setName('delete_days')
            .setDescription('Days of message history to delete (0-7)')
            .setMinValue(0)
            .setMaxValue(7)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Unban a user by their Discord user ID')
        .addStringOption(opt => opt.setName('user_id').setDescription('The user ID to unban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const targetUser = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') || 0;

      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (member) {
        if (!member.bannable) {
          return interaction.reply({ content: '❌ I cannot ban this member. Their role is higher than mine or they are server owner.', ephemeral: true });
        }
        if (member.id === interaction.user.id) {
          return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
        }
      }

      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        reason: `${reason} (Banned by ${interaction.user.tag})`
      });

      await db.infractions.add({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'ban',
        reason
      });

      await db.auditLogs.log(interaction.guild.id, 'MEMBER_BAN', `${targetUser.tag} was banned by ${interaction.user.tag}`, {
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        reason
      });

      const embed = new EmbedBuilder()
        .setTitle('⛔ Member Banned')
        .setColor('#ED4245')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      try {
        await interaction.guild.bans.remove(userId, `${reason} (Unbanned by ${interaction.user.tag})`);

        await db.infractions.add({
          guildId: interaction.guild.id,
          userId,
          moderatorId: interaction.user.id,
          type: 'unban',
          reason
        });

        const embed = new EmbedBuilder()
          .setTitle('✅ User Unbanned')
          .setColor('#57F287')
          .addFields(
            { name: 'User ID', value: userId, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({ content: `❌ Failed to unban user ID \`${userId}\`. Are they banned?`, ephemeral: true });
      }
    }
  }
};
