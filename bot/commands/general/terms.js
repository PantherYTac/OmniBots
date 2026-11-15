/**
 * Slash Command: /terms
 * Displays bot terms of service summary and direct link button to the hosted legal page
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('terms')
    .setDescription('View the official Terms of Service and user conduct rules'),

  async execute(interaction) {
    const baseUrl = process.env.DASHBOARD_URL || (process.env.CALLBACK_URL || '').replace(/\/auth\/discord\/callback\/?$/, '') || 'http://localhost:3000';
    const termsUrl = `${baseUrl}/terms`;

    const embed = new EmbedBuilder()
      .setTitle('📜 Terms of Service & Usage Guidelines')
      .setColor('#5865F2')
      .setDescription(
        'By inviting the bot or executing commands, you agree to these Terms and Discord Community Guidelines.'
      )
      .addFields(
        {
          name: '🎂 Age Requirement',
          value: 'You must be at least **13 years old** (or the minimum legal age in your country) to use the bot and Discord.',
          inline: false
        },
        {
          name: '🚫 Prohibited Exploits',
          value: 'Exploiting bugs, macros, auto-clickers, or self-bots to manipulate economy coins or leveling XP is strictly prohibited.',
          inline: false
        },
        {
          name: '🪙 Virtual Currency Disclaimer',
          value: 'All bot coins, items, and levels possess **ZERO real-world monetary value** and cannot be redeemed for fiat currency.',
          inline: false
        },
        {
          name: '⚖️ Service Availability',
          value: 'The bot is provided on an "as-is" basis. Server administrators and bot operators may modify or reset features when necessary.',
          inline: false
        }
      )
      .setFooter({ text: 'Click the button below to view the full verification-ready terms.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Full Terms of Service')
        .setStyle(ButtonStyle.Link)
        .setURL(termsUrl)
        .setEmoji('🔗')
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
