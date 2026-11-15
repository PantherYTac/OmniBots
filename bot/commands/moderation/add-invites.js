/**
 * Moderation Slash Command: /add-invites
 * Manually award or deduct bonus invites for a guild member
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { checkRoleRewards } = require('../../utils/inviteTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-invites')
    .setDescription('Award or deduct bonus invites for a server member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to modify bonus invites for')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of bonus invites to grant (use negative numbers to deduct, e.g. -3)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for adjusting bonus invites')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Manual admin adjustment';

    const guildSettings = await db.guilds.get(interaction.guild.id);
    const updatedRecord = await db.invites.addBonus(interaction.guild.id, targetUser.id, amount);

    const subtractLeaves = guildSettings.inviteTracking?.subtractLeaves !== false;
    const net = (updatedRecord.regular || 0) + (updatedRecord.bonus || 0) - (subtractLeaves ? (updatedRecord.leaves || 0) : 0);

    // Re-check role rewards for the target member
    await checkRoleRewards(interaction.guild, targetUser.id, updatedRecord, guildSettings);

    // Log to shared audit logs
    await db.auditLogs.log(interaction.guild.id, 'INVITES_BONUS', `${interaction.user.tag} adjusted bonus invites for ${targetUser.tag} by ${amount > 0 ? `+${amount}` : amount}`, {
      moderatorId: interaction.user.id,
      targetId: targetUser.id,
      amount,
      reason,
      newBonus: updatedRecord.bonus,
      netInvites: net
    });

    const embed = new EmbedBuilder()
      .setTitle('🎁 Bonus Invites Adjusted')
      .setColor('#57F287')
      .setDescription(
        `Successfully updated bonus invites for <@${targetUser.id}>!\n\n` +
        `• **Adjustment:** \`${amount > 0 ? `+${amount}` : amount}\`\n` +
        `• **New Bonus Total:** \`${updatedRecord.bonus}\`\n` +
        `• **New Net Total:** \`**${net}**\`\n` +
        `• **Reason:** ${reason}`
      )
      .setFooter({ text: `Action by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
