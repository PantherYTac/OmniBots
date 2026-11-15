/**
 * Economy Minigame: /slots
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const ICONS = ['🍒', '🍋', '🍇', '💎', '7️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the slot machine for a chance at a jackpot')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to wager').setMinValue(1).setRequired(true)),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const eco = await db.economy.get(guildId, userId);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';

    if ((eco.wallet || 0) < bet) {
      return interaction.reply({ content: `❌ You do not have enough coins in your wallet! (Balance: ${(eco.wallet || 0).toLocaleString()})`, ephemeral: true });
    }

    const s1 = ICONS[Math.floor(Math.random() * ICONS.length)];
    const s2 = ICONS[Math.floor(Math.random() * ICONS.length)];
    const s3 = ICONS[Math.floor(Math.random() * ICONS.length)];

    let multiplier = 0;
    if (s1 === s2 && s2 === s3) {
      if (s1 === '7️⃣') multiplier = 10;
      else if (s1 === '💎') multiplier = 7;
      else multiplier = 4;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      multiplier = 1.5;
    }

    const winnings = Math.floor(bet * multiplier);

    if (multiplier > 0) {
      eco.wallet += (winnings - bet);
    } else {
      eco.wallet -= bet;
    }

    await db.economy.save(guildId, userId, eco);

    const won = multiplier > 0;
    const embed = new EmbedBuilder()
      .setTitle('🎰 Slot Machine')
      .setColor(won ? '#57F287' : '#ED4245')
      .setDescription(`[ ${s1} | ${s2} | ${s3} ]\n\n` +
        (won
          ? `🎉 **WINNER!** You won **${symbol} ${winnings.toLocaleString()}** (${multiplier}x multiplier)!`
          : `💀 **No match!** You lost **${symbol} ${bet.toLocaleString()}**.`
        ))
      .addFields({ name: 'Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
