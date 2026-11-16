/**
 * Ticket Command: /ticket-add <user>
 * Add a member to the current ticket channel permissions
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Add a member to the current ticket channel')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to add to this ticket')
        .setRequired(true)
    ),
  aliases: ['ticketadd', 't-add'],
  module: 'tickets',

  async execute(ctx) {
    const ticket = await db.tickets.getByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({ content: '❌ This command can only be executed inside an active ticket channel.', ephemeral: true });
    }

    const targetUser = ctx.options.getUser('user', true);
    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a user to add to this ticket.', ephemeral: true });
    }

    // Permission check: Opener, Staff, or ManageChannels
    const isOpener = ticket.openerId === ctx.user.id || ticket.userId === ctx.user.id;
    const canManage = ctx.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
    if (!isOpener && !canManage) {
      return ctx.reply({ content: '🚫 Only the ticket creator or server staff can add members.', ephemeral: true });
    }

    await ctx.channel.permissionOverwrites.edit(targetUser.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setDescription(`➕ ${targetUser} has been added to this ticket by ${ctx.user}.`);

    return ctx.reply({ embeds: [embed] });
  }
};
