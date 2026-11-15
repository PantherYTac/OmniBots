/**
 * Moderation Slash Command: /reset-invites
 * Reset an individual's invites or wipe all guild invite records with interactive confirmation
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-invites')
    .setDescription('Reset an individual user\'s invite statistics or wipe all server invites')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member whose invites you wish to reset (leave empty to reset ALL server invites)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');

    // 1. Single User Reset
    if (targetUser) {
      await db.invites.reset(interaction.guild.id, targetUser.id);

      await db.auditLogs.log(interaction.guild.id, 'INVITES_RESET', `${interaction.user.tag} reset invite stats for ${targetUser.tag}`, {
        moderatorId: interaction.user.id,
        targetId: targetUser.id
      });

      const embed = new EmbedBuilder()
        .setTitle('🔄 Invites Reset')
        .setColor('#ED4245')
        .setDescription(`Successfully cleared all regular, bonus, leaves, and fake invite records for <@${targetUser.id}>.`)
        .setFooter({ text: `Reset performed by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. Full Server Invite Wipe (Requires Confirmation)
    const confirmButtonId = `wipe_invites_confirm_${Date.now()}`;
    const cancelButtonId = `wipe_invites_cancel_${Date.now()}`;

    const warnEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Server-Wide Invite Reset')
      .setColor('#ED4245')
      .setDescription(
        '**Warning:** You are about to wipe **ALL** invite counts (regular, bonus, leaves, fake) for every member in this server!\n\n' +
        'This action is permanent and cannot be undone. Do you wish to proceed?'
      )
      .setFooter({ text: 'This confirmation prompt expires in 60 seconds.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmButtonId)
        .setLabel('Yes, Wipe All Invites')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelButtonId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const promptMsg = await interaction.reply({
      embeds: [warnEmbed],
      components: [row],
      fetchReply: true
    });

    const collector = promptMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({ content: '❌ Only the administrator who initiated the command can confirm this wipe.', ephemeral: true });
      }

      if (btnInteraction.customId === confirmButtonId) {
        await db.invites.reset(interaction.guild.id);

        await db.auditLogs.log(interaction.guild.id, 'INVITES_WIPE', `${interaction.user.tag} wiped all invite statistics for the entire guild`, {
          moderatorId: interaction.user.id
        });

        const successEmbed = new EmbedBuilder()
          .setTitle('🗑️ Server Invites Wiped')
          .setColor('#57F287')
          .setDescription(`All server invite statistics for **${interaction.guild.name}** have been completely reset to 0.`)
          .setFooter({ text: `Action authorized by ${interaction.user.tag}` })
          .setTimestamp();

        await btnInteraction.update({ embeds: [successEmbed], components: [] });
      } else {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ Reset Cancelled')
          .setColor('#747F8D')
          .setDescription('Server invite reset has been aborted. No records were modified.');

        await btnInteraction.update({ embeds: [cancelEmbed], components: [] });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⌛ Prompt Timed Out')
          .setColor('#747F8D')
          .setDescription('Reset confirmation timed out. Operation cancelled.');
        await promptMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });
  }
};
