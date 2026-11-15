/**
 * Moderation Command: /kick
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt => opt.setName('target').setDescription('The member to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: '❌ I cannot kick this member. Their role is higher than mine or they are server owner.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot kick yourself.', ephemeral: true });
    }

    await member.kick(`${reason} (Kicked by ${interaction.user.tag})`);

    await db.infractions.add({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      type: 'kick',
      reason
    });

    await db.auditLogs.log(interaction.guild.id, 'MEMBER_KICK', `${targetUser.tag} was kicked by ${interaction.user.tag}`, {
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason
    });

    const embed = new EmbedBuilder()
      .setTitle('🚪 Member Kicked')
      .setColor('#FEE75C')
      .addFields(
        { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
