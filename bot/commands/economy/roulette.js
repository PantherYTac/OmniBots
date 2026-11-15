/**
 * Economy Command: /roulette
 * Casino roulette gambling mini-game (Red, Black, Green, or exact number)
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  module: 'economy',
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Bet your coins on the casino roulette wheel')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Amount of coins to gamble').setMinValue(10).setRequired(true))
    .addStringOption(opt =>
      opt.setName('space')
        .setDescription('Space to bet on (red, black, green, or 0-36)')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Red (2x Payout)', value: 'red' },
          { name: '⚫ Black (2x Payout)', value: 'black' },
          { name: '🟢 Green / 0 (14x Payout)', value: 'green' }
        )
    ),

  async execute(ctx) {
    const bet = ctx.options.getInteger('bet');
    const space = (ctx.options.getString('space') || 'red').toLowerCase();

    const eco = await db.economy.get(ctx.guild.id, ctx.user.id);
    if ((eco.wallet || 0) < bet) {
      return ctx.reply({ content: `❌ Insufficient coins! Your wallet has **${(eco.wallet || 0).toLocaleString()} coins**.`, ephemeral: true });
    }

    // Roulette wheel 0-36
    const roll = Math.floor(Math.random() * 37); // 0 to 36
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

    let rollColor = 'black';
    if (roll === 0) rollColor = 'green';
    else if (redNumbers.includes(roll)) rollColor = 'red';

    const colorEmoji = rollColor === 'green' ? '🟢' : (rollColor === 'red' ? '🔴' : '⚫');

    let won = false;
    let multiplier = 0;

    if (space === rollColor) {
      won = true;
      multiplier = rollColor === 'green' ? 14 : 2;
    }

    if (won) {
      const winnings = bet * multiplier;
      eco.wallet += (winnings - bet);
      await db.economy.save(ctx.guild.id, ctx.user.id, eco);

      const embed = new EmbedBuilder()
        .setTitle('🎰 Roulette Winner!')
        .setColor(rollColor === 'green' ? '#57F287' : (rollColor === 'red' ? '#ED4245' : '#2C2F33'))
        .setDescription(`The roulette wheel spun and landed on **${colorEmoji} ${roll} (${rollColor.toUpperCase()})**!`)
        .addFields(
          { name: 'Your Bet', value: `${bet.toLocaleString()} on ${space.toUpperCase()}`, inline: true },
          { name: 'Payout', value: `+${winnings.toLocaleString()} coins (${multiplier}x)`, inline: true },
          { name: 'New Wallet', value: `🪙 ${eco.wallet.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    } else {
      eco.wallet -= bet;
      await db.economy.save(ctx.guild.id, ctx.user.id, eco);

      const embed = new EmbedBuilder()
        .setTitle('🎰 Roulette Result')
        .setColor('#ED4245')
        .setDescription(`The roulette wheel spun and landed on **${colorEmoji} ${roll} (${rollColor.toUpperCase()})**!`)
        .addFields(
          { name: 'Your Bet', value: `${bet.toLocaleString()} on ${space.toUpperCase()}`, inline: true },
          { name: 'Result', value: `-${bet.toLocaleString()} coins`, inline: true },
          { name: 'New Wallet', value: `🪙 ${eco.wallet.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    }
  }
};