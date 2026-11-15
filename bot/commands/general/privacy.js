/**
 * Slash Command: /privacy
 * Displays bot privacy policy summary and direct link button to the hosted legal page
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('View the official Privacy Policy and Discord Developer compliance guarantees'),

  async execute(interaction) {
    const baseUrl = process.env.DASHBOARD_URL || (process.env.CALLBACK_URL || '').replace(/\/auth\/discord\/callback\/?$/, '') || 'http://localhost:3000';
    const privacyUrl = `${baseUrl}/privacy`;

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Privacy Policy & Data Guarantees')
      .setColor('#5865F2')
      .setDescription(
        'We take data protection and Discord Developer Policy compliance seriously. Here is a summary of how your information is handled:'
      )
      .addFields(
        {
          name: '🔒 Zero Data Selling',
          value: 'We **never** sell, license, or monetize your Discord data or messages with data brokers, advertisers, or third parties.',
          inline: false
        },
        {
          name: '🤖 AI Safety Guarantee',
          value: 'Queries sent to the `/ask` AI command are processed ephemerally via Google Gemini and are **never used to train AI models**.',
          inline: false
        },
        {
          name: '⚡ Privileged Intents',
          value: 'Message content is scanned in-memory for real-time auto-mod rules and is never permanently stored without administrative authorization.',
          inline: false
        },
        {
          name: '🗑️ User Deletion Rights',
          value: 'You have the right to erase all your stored data anytime by running the `/delete-my-data` slash command.',
          inline: false
        }
      )
      .setFooter({ text: 'Click the button below to view the full verification-ready policy.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Full Privacy Policy')
        .setStyle(ButtonStyle.Link)
        .setURL(privacyUrl)
        .setEmoji('🔗')
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
