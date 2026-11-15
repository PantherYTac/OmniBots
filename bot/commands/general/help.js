/**
 * General Command: /help
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View comprehensive list of commands and system modules'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⚡ All-in-One Discord System Commands')
      .setDescription('Explore all available commands by selecting a category from the dropdown menu below, or visit the Web Dashboard for visual server controls!')
      .setColor('#5865F2')
      .addFields(
        { name: '🛡️ Moderation', value: '`/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/slowmode`, `/lock`', inline: false },
        { name: '⭐ Leveling & XP', value: '`/rank`, `/leaderboard` (Text & Voice XP tracking)', inline: false },
        { name: '💰 Economy & Games', value: '`/balance`, `/daily`, `/work`, `/pay`, `/shop`, `/coinflip`, `/slots`, `/blackjack`', inline: false },
        { name: '🎫 Support & Tickets', value: '`/ticket-panel` (Multi-category tickets with HTML exports)', inline: false },
        { name: '🎉 Community & Utility', value: '`/suggest`, `/giveaway`, `/poll`, `/remindme`, `/set-birthday`, `/ask`', inline: false }
      )
      .setFooter({ text: 'All settings fully manageable via the Web Dashboard' });

    return interaction.reply({ embeds: [embed] });
  }
};
