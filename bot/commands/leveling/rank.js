/**
 * Leveling Command: /rank
 * Generates custom visual rank card via @napi-rs/canvas
 */

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { generateRankCard } = require('../../utils/canvasRankCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your server rank, level, and XP card')
    .addUserOption(opt => opt.setName('user').setDescription('User whose rank to inspect')),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const userLevel = await db.levels.get(interaction.guild.id, targetUser.id);
    const leaderboard = await db.levels.getLeaderboard(interaction.guild.id, 500);

    let rankIndex = leaderboard.findIndex(u => u.userId === targetUser.id);
    if (rankIndex === -1) rankIndex = leaderboard.length;
    const rankPos = rankIndex + 1;

    try {
      const buffer = await generateRankCard(targetUser, member, userLevel, rankPos);
      const isSvg = Buffer.isBuffer(buffer) && buffer.toString('utf8', 0, 10).includes('<svg');
      const ext = isSvg ? 'svg' : 'png';
      const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.${ext}` });

      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      console.error('Failed to generate rank card canvas:', err);
      return interaction.editReply({
        content: `📊 **${targetUser.username}** — **Level ${userLevel.level}** | **${userLevel.xp.toLocaleString()} XP** (Rank #${rankPos})`
      });
    }
  }
};
