/**
 * Event: interactionCreate
 * Routes slash commands and persistent UI components
 */

const logger = require('../../shared/utils/logger');
const { handleInteraction } = require('../handlers/componentHandler');
const { handleSlashCommand } = require('../handlers/commandRouter');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // 1. Handle Slash Commands with Unified Router
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, client);
        return;
      }

      // 2. Handle Buttons, Select Menus & Modals
      await handleInteraction(interaction);
    } catch (err) {
      logger.error(`Error executing interaction ${interaction.customId || interaction.commandName}`, err, 'INTERACTION');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ An unexpected error occurred while executing this action.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ An unexpected error occurred while executing this action.', ephemeral: true }).catch(() => {});
      }
    }
  }
};
