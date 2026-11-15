/**
 * Moderation Commands: /timeout and /untimeout
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { parseDuration, formatDuration } = require('../../../shared/utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) or remove timeout from a member')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Place a member in timeout')
        .addUserOption(opt => opt.setName('target').setDescription('The member to timeout').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove timeout from a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to remove timeout from').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: '❌ I cannot moderate this member. Their role is higher than mine or they are server owner.', ephemeral: true });
    }

    if (sub === 'add') {
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);

      if (!durationMs || durationMs < 1000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
        return interaction.reply({ content: '❌ Invalid duration. Please provide a duration between 1 minute and 28 days (e.g. `10m`, `1h`, `1d`).', ephemeral: true });
      }

      await member.timeout(durationMs, `${reason} (Timed out by ${interaction.user.tag})`);

      await db.infractions.add({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'timeout',
        duration: durationStr,
        reason
      });

      await db.auditLogs.log(interaction.guild.id, 'MEMBER_TIMEOUT', `${targetUser.tag} timed out for ${durationStr} by ${interaction.user.tag}`, {
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        duration: durationStr,
        reason
      });

      const embed = new EmbedBuilder()
        .setTitle('🔇 Member Timed Out')
        .setColor('#FFA500')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Duration', value: formatDuration(durationMs), inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const reason = interaction.options.getString('reason') || 'No reason provided';

      await member.timeout(null, `${reason} (Timeout removed by ${interaction.user.tag})`);

      await db.infractions.add({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'untimeout',
        reason
      });

      const embed = new EmbedBuilder()
        .setTitle('🔊 Timeout Removed')
        .setColor('#57F287')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
