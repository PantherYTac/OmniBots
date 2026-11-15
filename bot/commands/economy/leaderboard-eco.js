/**
 * Economy Command: /leaderboard-eco
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard-eco')
    .setDescription('View top wealthiest members on the server'),

  async execute(interaction) {
    const list = await db.economy.getLeaderboard(interaction.guild.id, 10);
    const settings = await db.guilds.get(interaction.guild.id);
    const symbol = settings.economy?.currencySymbol || '🪙';

    if (list.length === 0) {
      return interaction.reply({ content: '💰 No economy data recorded on this server yet.', ephemeral: true });
    }

    const rows = await Promise.all(list.map(async (entry, index) => {
      let medal = `**#${index + 1}**`;
      if (index === 0) medal = '🥇';
      if (index === 1) medal = '🥈';
      if (index === 2) medal = '🥉';

      const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
      const name = user ? user.username : `User ${entry.userId}`;
      const total = (entry.wallet || 0) + (entry.bank || 0);

      return `${medal} **${name}** — ${symbol} **${total.toLocaleString()}** *(Wallet: ${entry.wallet || 0} | Bank: ${entry.bank || 0})*`;
    }));

    const embed = new EmbedBuilder()
      .setTitle(`💎 ${interaction.guild.name} Wealth Leaderboard`)
      .setColor('#FEE75C')
      .setDescription(rows.join('\n\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
