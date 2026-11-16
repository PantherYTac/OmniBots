/**
 * Ticket Command: /ticket-claim
 * Claim or unclaim the current ticket
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-claim')
    .setDescription('Claim or unclaim the current ticket channel'),
  aliases: ['ticketclaim', 'claim-ticket', 'claim'],
  module: 'tickets',

  async execute(ctx) {
    const ticket = await db.tickets.getByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({ content: '❌ This command can only be executed inside an active ticket channel.', ephemeral: true });
    }

    if (ticket.claimedBy === ctx.user.id) {
      await db.tickets.update(ticket.id, { claimedBy: null, claimedByTag: null });
      const embed = new EmbedBuilder()
        .setColor('#8B949E')
        .setDescription(`ℹ️ ${ctx.user} has **unclaimed** this ticket. It is now open for other staff.`);
      return ctx.reply({ embeds: [embed] });
    } else {
      await db.tickets.update(ticket.id, { claimedBy: ctx.user.id, claimedByTag: ctx.user.tag });
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setDescription(`🙋‍♂️ **Ticket Claimed!** ${ctx.user} is now managing this support ticket.`);
      return ctx.reply({ embeds: [embed] });
    }
  }
};
