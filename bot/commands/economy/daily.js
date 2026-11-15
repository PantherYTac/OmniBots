/**
 * Economy Command: /daily with Streak Multiplier
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily currency reward and build your streak'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const eco = await db.economy.get(guildId, userId);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const twoDays = 48 * 60 * 60 * 1000;

    const lastDaily = eco.lastDaily || 0;
    const timeSinceLast = now - lastDaily;

    if (timeSinceLast < oneDay) {
      const nextTime = Math.floor((lastDaily + oneDay) / 1000);
      return interaction.reply({
        content: `⏳ You have already claimed your daily reward! You can claim again <t:${nextTime}:R>.`,
        ephemeral: true
      });
    }

    // Check streak
    let streak = eco.dailyStreak || 0;
    if (timeSinceLast <= twoDays) {
      streak += 1;
    } else {
      streak = 1; // reset streak if missed a day
    }

    const baseReward = Math.floor(Math.random() * (250 - 100 + 1)) + 100;
    const streakBonus = Math.min(200, streak * 15);
    const totalReward = baseReward + streakBonus;

    eco.wallet = (eco.wallet || 0) + totalReward;
    eco.lastDaily = now;
    eco.dailyStreak = streak;

    await db.economy.save(guildId, userId, eco);

    const embed = new EmbedBuilder()
      .setTitle('💰 Daily Reward Claimed!')
      .setColor('#57F287')
      .setDescription(`You received **${symbol} ${totalReward.toLocaleString()}**!`)
      .addFields(
        { name: 'Base Reward', value: `${symbol} ${baseReward}`, inline: true },
        { name: 'Streak Bonus', value: `+${symbol} ${streakBonus}`, inline: true },
        { name: 'Current Streak', value: `🔥 **${streak} days**`, inline: true },
        { name: 'New Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
