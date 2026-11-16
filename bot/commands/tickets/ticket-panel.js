/**
 * Tickets Command: /ticket-panel
 * Deploys an interactive multi-category ticket panel (buttons or dropdown)
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
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
    .addStringOption(opt => opt.setName('panel_id').setDescription('ID of pre-configured panel from dashboard (optional)'))
    .addStringOption(opt => opt.setName('title').setDescription('Panel embed title'))
    .addStringOption(opt => opt.setName('description').setDescription('Panel embed instructions'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  aliases: ['ticketpanel', 'panel-ticket', 'tickets-panel'],
  module: 'tickets',

  async execute(ctx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return ctx.reply({ content: '🚫 You need `Manage Server` permissions to deploy ticket panels.', ephemeral: true });
    }

    const targetChannel = ctx.options.getChannel('channel') || ctx.channel;
    const panelId = ctx.options.getString('panel_id');

    let title = ctx.options.getString('title');
    let description = ctx.options.getString('description');
    let selectorStyle = 'buttons';
    let color = '#5865F2';
    let categoryList = [];

    const botId = ctx.client.botId || 'primary';
    const allCategories = await db.ticketCategories.list(ctx.guild.id, botId);

    if (panelId) {
      const panel = await db.ticketPanels.get(panelId);
      if (panel) {
        title = panel.panelEmbed?.title || title;
        description = panel.panelEmbed?.description || description;
        color = panel.panelEmbed?.color || color;
        selectorStyle = panel.selectorStyle || 'buttons';
        if (Array.isArray(panel.categoryIds) && panel.categoryIds.length > 0) {
          categoryList = allCategories.filter(c => panel.categoryIds.includes(c.id));
        }
      }
    }

    if (categoryList.length === 0) {
      categoryList = allCategories;
    }

    if (categoryList.length === 0) {
      return ctx.reply({ content: '❌ No ticket categories found. Please configure categories in the dashboard first.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(title || '🎫 Server Support Desk')
      .setDescription(description || 'Need help, want to report a rule-breaker, or have a question about the server?\nClick a department button below to open a private support ticket with our staff team!')
      .setColor(color)
      .setFooter({ text: 'A private channel will be created exclusively for you and staff' })
      .setTimestamp();

    const components = [];

    if (selectorStyle === 'dropdown' || categoryList.length > 5) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_category')
        .setPlaceholder('Select a support department to open a ticket...')
        .addOptions(
          categoryList.slice(0, 25).map(cat => ({
            label: cat.name.substring(0, 100),
            description: (cat.description || `Open a ${cat.name} ticket`).substring(0, 100),
            value: cat.id,
            emoji: cat.emoji || undefined
          }))
        );

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    } else {
      const styleMap = {
        'Primary': ButtonStyle.Primary,
        'Secondary': ButtonStyle.Secondary,
        'Success': ButtonStyle.Success,
        'Danger': ButtonStyle.Danger
      };

      const buttons = categoryList.slice(0, 5).map(cat => {
        const btn = new ButtonBuilder()
          .setCustomId(`ticket_create:${cat.id}`)
          .setLabel(cat.name)
          .setStyle(styleMap[cat.buttonColor] || ButtonStyle.Primary);

        if (cat.emoji) btn.setEmoji(cat.emoji);
        return btn;
      });

      components.push(new ActionRowBuilder().addComponents(buttons));
    }

    const sentMessage = await targetChannel.send({ embeds: [embed], components });

    // If panelId was provided, update panel message ID in database
    if (panelId) {
      await db.ticketPanels.save(panelId, {
        channelId: targetChannel.id,
        messageId: sentMessage.id
      });
    }

    return ctx.reply({
      content: `✅ Ticket panel successfully deployed to ${targetChannel}!`,
      ephemeral: true
    });
  }
};
