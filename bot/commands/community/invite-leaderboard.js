/**
 * Slash Command: /invite-leaderboard
 * Displays the top inviters in the server with interactive pagination buttons
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { db } = require('../../../shared');

const PAGE_SIZE = 10;

function generateEmbed(leaderboard, page, totalPages, guildName, guildIcon) {
  const start = page * PAGE_SIZE;
  const currentChunk = leaderboard.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Invite Leaderboard • ${guildName}`)
    .setColor('#FEE75C')
    .setFooter({
      text: `Page ${page + 1} of ${totalPages || 1} • Formula: Regular + Bonus - Leaves`,
      iconURL: guildIcon
    })
    .setTimestamp();

  if (currentChunk.length === 0) {
    embed.setDescription('No invites recorded yet! Create an invite link and share it to rank #1!');
    return embed;
  }

  const lines = currentChunk.map((item, idx) => {
    const rank = start + idx + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
    return `${medal} <@${item.userId}> — **${item.net}** net \`(${item.regular} regular, ${item.bonus} bonus, -${item.leaves} leaves, ${item.fake} fake)\``;
  });

  embed.setDescription(lines.join('\n'));
  return embed;
}

function generateButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('inv_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('inv_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite-leaderboard')
    .setDescription('View the top server inviters leaderboard'),

  async execute(interaction) {
    const leaderboard = await db.invites.getLeaderboard(interaction.guild.id, 100);
    const totalPages = Math.ceil(leaderboard.length / PAGE_SIZE) || 1;
    let page = 0;

    const initialEmbed = generateEmbed(leaderboard, page, totalPages, interaction.guild.name, interaction.guild.iconURL());
    const initialRow = generateButtons(page, totalPages);

    const message = await interaction.reply({
      embeds: [initialEmbed],
      components: totalPages > 1 ? [initialRow] : [],
      fetchReply: true
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000 // 2 minutes
    });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({ content: '❌ Only the command caller can paginate this leaderboard.', ephemeral: true });
      }

      if (btnInteraction.customId === 'inv_prev' && page > 0) {
        page--;
      } else if (btnInteraction.customId === 'inv_next' && page < totalPages - 1) {
        page++;
      }

      const updatedEmbed = generateEmbed(leaderboard, page, totalPages, interaction.guild.name, interaction.guild.iconURL());
      const updatedRow = generateButtons(page, totalPages);

      await btnInteraction.update({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('inv_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await message.edit({ components: [disabledRow] }).catch(() => {});
    });
  }
};
