/**
 * Ticket Command: /ticket-rename <name>
 * Rename the current ticket channel
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Rename the current ticket channel')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('New channel name for this ticket')
        .setRequired(true)
    ),
  aliases: ['ticketrename', 't-rename'],
  module: 'tickets',

  async execute(ctx) {
    const ticket = await db.tickets.getByChannel(ctx.channel.id);
    if (!ticket) {
      return ctx.reply({ content: '❌ This command can only be executed inside an active ticket channel.', ephemeral: true });
    }

    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return ctx.reply({ content: '🚫 You need `Manage Channels` permissions to rename ticket channels.', ephemeral: true });
    }

    const rawName = ctx.options.getString('name', true);
    const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').substring(0, 100);

    const oldName = ctx.channel.name;
    await ctx.channel.setName(cleanName);

    const embed = new EmbedBuilder()
      .setColor('#38BDF8')
      .setDescription(`✏️ Channel renamed from **#${oldName}** to **#${cleanName}** by ${ctx.user}.`);

    return ctx.reply({ embeds: [embed] });
  }
};
