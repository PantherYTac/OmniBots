/**
 * Slash Command: /delete-my-data
 * Self-service GDPR & Discord Developer Policy user data deletion engine
 * Permanently erases all leveling XP, economy balances, birthdays, reminders, and invite statistics
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-my-data')
    .setDescription('Permanently erase all your personal data (XP, economy, birthdays, invites) from the bot database'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const confirmId = `del_data_confirm_${Date.now()}`;
    const cancelId = `del_data_cancel_${Date.now()}`;

    const warningEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Permanent Data Deletion')
      .setColor('#ED4245')
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(
        `Hello <@${userId}>,\n\n` +
        'In compliance with the **Discord Developer Policy**, **GDPR**, and global privacy standards, you have the right to permanently erase your data from our database.\n\n' +
        '**The following records associated with your account will be PERMANENTLY deleted:**\n' +
        '• 📊 **Leveling & Experience:** All text & voice XP, levels, and rank cards across all servers.\n' +
        '• 🪙 **Server Economy:** All wallet/bank balances, daily streaks, and purchased inventory items.\n' +
        '• 🎂 **Community Birthdays:** Any registered birthday dates and announcements.\n' +
        '• 📨 **Invite Tracking:** All recorded regular, bonus, leaves, and fake invite statistics.\n' +
        '• 🛡️ **Moderation History:** Any warnings, infraction logs, or sticky roles targeting your account.\n\n' +
        '⚠️ **Warning:** This action is **irreversible**. Your XP and balances cannot be recovered once purged.'
      )
      .setFooter({ text: 'This confirmation prompt expires in 60 seconds.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel('Confirm Permanent Deletion')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const promptMessage = await interaction.reply({
      embeds: [warningEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    const collector = promptMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({ content: '❌ You cannot interact with this prompt.', ephemeral: true });
      }

      if (btnInteraction.customId === confirmId) {
        // Execute database purge
        const purgeSummary = await db.compliance.deleteUserData(userId);

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Your Personal Data Has Been Permanently Erased')
          .setColor('#57F287')
          .setDescription(
            `All personal records associated with <@${userId}> have been **permanently expunged** from our databases.\n\n` +
            '**Purge Summary:**\n' +
            `• **Leveling Records Purged:** \`${purgeSummary.levelsPurged}\`\n` +
            `• **Economy Accounts Purged:** \`${purgeSummary.economyPurged}\`\n` +
            `• **Invite Statistics Cleared:** \`${purgeSummary.invitesPurged}\`\n` +
            `• **Member Attributions Cleared:** \`${purgeSummary.memberAttributionPurged}\`\n` +
            `• **Birthdays Cleared:** \`${purgeSummary.birthdaysPurged}\`\n` +
            `• **Infractions Cleared:** \`${purgeSummary.infractionsPurged}\`\n\n` +
            'Thank you for using our self-service data protection system. If you interact with bot features in the future, a fresh profile will be created.'
          )
          .setFooter({ text: 'Discord Developer Policy & GDPR Data Request Completed' })
          .setTimestamp();

        await btnInteraction.update({
          embeds: [successEmbed],
          components: []
        });
      } else {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ Data Deletion Cancelled')
          .setColor('#747F8D')
          .setDescription('Your data deletion request was cancelled. All your XP, economy balances, and server stats remain intact.')
          .setTimestamp();

        await btnInteraction.update({
          embeds: [cancelEmbed],
          components: []
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        const timeoutRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('timeout_1').setLabel('Prompt Expired').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await promptMessage.edit({ components: [timeoutRow] }).catch(() => {});
      }
    });
  }
};
