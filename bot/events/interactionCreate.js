/**
 * Event: interactionCreate
 * Routes slash commands and persistent UI components
 */

const logger = require('../../shared/utils/logger');
const { handleInteraction } = require('../handlers/componentHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // 1. Handle Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return interaction.reply({ content: '❌ Unknown application command.', ephemeral: true });
        }

        await command.execute(interaction);
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
