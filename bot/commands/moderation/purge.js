/**
 * Moderation Command: /purge
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages with smart filters')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to scan & delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Filter messages to delete')
        .addChoices(
          { name: 'All Messages', value: 'all' },
          { name: 'Bot Messages Only', value: 'bots' },
          { name: 'Human Users Only', value: 'humans' },
          { name: 'Messages with Links', value: 'links' }
        )
    )
    .addUserOption(opt => opt.setName('user').setDescription('Purge only messages sent by a specific user'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const filter = interaction.options.getString('filter') || 'all';
    const specificUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: amount });

    const linkRegex = /(https?:\/\/[^\s]+)/gi;

    const filtered = messages.filter(msg => {
      // Cannot delete messages older than 14 days
      const isTooOld = Date.now() - msg.createdTimestamp > 14 * 24 * 60 * 60 * 1000;
      if (isTooOld) return false;

      if (specificUser && msg.author.id !== specificUser.id) return false;

      if (filter === 'bots') return msg.author.bot;
      if (filter === 'humans') return !msg.author.bot;
      if (filter === 'links') return linkRegex.test(msg.content);

      return true;
    });

    if (filtered.size === 0) {
      return interaction.editReply({ content: '⚠️ No messages matched your filter criteria (or messages are older than 14 days).' });
    }

    const deleted = await interaction.channel.bulkDelete(filtered, true);

    await db.auditLogs.log(interaction.guild.id, 'PURGE_MESSAGES', `${deleted.size} messages purged in #${interaction.channel.name} by ${interaction.user.tag}`, {
      moderatorId: interaction.user.id,
      channelId: interaction.channel.id,
      count: deleted.size,
      filter
    });

    return interaction.editReply({
      content: `🧹 Successfully purged **${deleted.size}** messages with filter \`${filter}\`${specificUser ? ` for ${specificUser}` : ''}.`
    });
  }
};
