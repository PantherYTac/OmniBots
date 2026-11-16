/**
 * Ticket Command: /ticket-remove <user>
 * Remove a member from the current ticket channel permissions
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('Remove a member from the current ticket channel')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to remove from this ticket')
        .setRequired(true)
    ),
  aliases: ['ticketremove', 't-remove'],
  module: 'tickets',

  async execute(ctx) {
    const ticket = await db.tickets.getByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({ content: '❌ This command can only be executed inside an active ticket channel.', ephemeral: true });
    }

    const targetUser = ctx.options.getUser('user', true);
    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a user to remove from this ticket.', ephemeral: true });
    }

    if (targetUser.id === ticket.openerId || targetUser.id === ticket.userId) {
      return ctx.reply({ content: '❌ You cannot remove the ticket creator from their own ticket.', ephemeral: true });
    }

    const isOpener = ticket.openerId === ctx.user.id || ticket.userId === ctx.user.id;
    const canManage = ctx.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
    if (!isOpener && !canManage) {
      return ctx.reply({ content: '🚫 Only the ticket creator or server staff can remove members.', ephemeral: true });
    }

    await ctx.channel.permissionOverwrites.delete(targetUser.id).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setDescription(`➖ ${targetUser} has been removed from this ticket by ${ctx.user}.`);

    return ctx.reply({ embeds: [embed] });
  }
};
