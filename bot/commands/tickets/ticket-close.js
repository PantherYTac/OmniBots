/**
 * Ticket Command: /ticket-close [reason]
 * Closes the current ticket channel and exports an HTML transcript
 */

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { db } = require('../../../shared');
const { closeTicketFinal } = require('../../handlers/ticketHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the current ticket channel and export an HTML transcript')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for closing this ticket')
        .setRequired(false)
    ),
  aliases: ['ticketclose', 'close-ticket', 'close'],
  module: 'tickets',

  async execute(ctx) {
    const ticket = await db.tickets.getByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({ content: '❌ This command can only be executed inside an active ticket channel.', ephemeral: true });
    }

    const reason = ctx.options.getString('reason') || 'Closed via command by staff.';

    // Execute standard close workflow
    return closeTicketFinal(ctx.isSlash ? ctx.interaction : ctx, ticket.id, reason);
  }
};
