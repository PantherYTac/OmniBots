/**
 * Leveling Command: /leaderboard
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server XP & Leveling leaderboard'),

  async execute(interaction) {
    const list = await db.levels.getLeaderboard(interaction.guild.id, 10);

    if (list.length === 0) {
      return interaction.reply({ content: '📊 No XP activity recorded on this server yet. Start chatting to gain XP!', ephemeral: true });
    }

    const rows = await Promise.all(list.map(async (entry, index) => {
      let medal = `**#${index + 1}**`;
      if (index === 0) medal = '🥇';
      if (index === 1) medal = '🥈';
      if (index === 2) medal = '🥉';

      const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
      const name = user ? user.username : `User ${entry.userId}`;

      return `${medal} **${name}** — Level **${entry.level}** (${(entry.xp || 0).toLocaleString()} XP)`;
    }));

    const domain = process.env.CALLBACK_URL ? new URL(process.env.CALLBACK_URL).origin : 'http://localhost:3000';
    const webLeaderboardUrl = `${domain}/leaderboard/${interaction.guild.id}`;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${interaction.guild.name} Level Leaderboard`)
      .setColor('#5865F2')
      .setDescription(rows.join('\n\n'))
      .setFooter({ text: 'View full leaderboard with progress bars on the Web Dashboard' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Web Leaderboard')
        .setStyle(ButtonStyle.Link)
        .setURL(webLeaderboardUrl)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
