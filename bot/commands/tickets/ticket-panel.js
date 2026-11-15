/**
 * Tickets Command: /ticket-panel
 * Deploys an interactive multi-category ticket panel
 */

const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Deploy an interactive support ticket panel to a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the ticket panel in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(opt => opt.setName('title').setDescription('Panel embed title'))
    .addStringOption(opt => opt.setName('description').setDescription('Panel embed instructions'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '🎫 Server Support & Assistance';
    const description = interaction.options.getString('description') ||
      'Need help, want to report a rule-breaker, or have a question about the server?\nClick a button below to open a private support ticket with our staff team!';

    const guildSettings = await db.guilds.get(interaction.guild.id);
    const categories = guildSettings.tickets?.categories || [
      { id: 'general', label: 'General Support', emoji: '🎫' },
      { id: 'billing', label: 'Billing & Shop', emoji: '💳' },
      { id: 'report', label: 'Player Report', emoji: '🚨' }
    ];

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#5865F2')
      .setFooter({ text: 'A private channel will be created exclusively for you and staff' });

    const buttons = categories.slice(0, 5).map(cat => {
      const btn = new ButtonBuilder()
        .setCustomId(`ticket_create:${cat.id}`)
        .setLabel(cat.label)
        .setStyle(ButtonStyle.Primary);

      if (cat.emoji) btn.setEmoji(cat.emoji);
      return btn;
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    await targetChannel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: `✅ Ticket panel successfully deployed to ${targetChannel}!`,
      ephemeral: true
    });
  }
};
