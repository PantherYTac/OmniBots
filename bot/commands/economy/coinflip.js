/**
 * Economy Minigame: /coinflip
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Bet your coins on a coin flip')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Amount of coins to wager').setMinValue(1).setRequired(true))
    .addStringOption(opt =>
      opt.setName('choice')
        .setDescription('Heads or Tails')
        .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
        .setRequired(true)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const choice = interaction.options.getString('choice');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const eco = await db.economy.get(guildId, userId);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';

    if ((eco.wallet || 0) < bet) {
      return interaction.reply({ content: `❌ You do not have enough coins in your wallet! (Balance: ${(eco.wallet || 0).toLocaleString()})`, ephemeral: true });
    }

    const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = outcome === choice;

    if (won) {
      eco.wallet += bet;
    } else {
      eco.wallet -= bet;
    }

    await db.economy.save(guildId, userId, eco);

    const embed = new EmbedBuilder()
      .setTitle(`🪙 Coinflip: The coin landed on ${outcome.toUpperCase()}!`)
      .setColor(won ? '#57F287' : '#ED4245')
      .setDescription(won ? `🎉 **You won ${symbol} ${bet.toLocaleString()}!**` : `💀 **You lost ${symbol} ${bet.toLocaleString()}!**`)
      .addFields(
        { name: 'Your Pick', value: choice.toUpperCase(), inline: true },
        { name: 'Result', value: outcome.toUpperCase(), inline: true },
        { name: 'New Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
