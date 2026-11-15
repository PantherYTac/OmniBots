/**
 * Economy Minigame: /rps
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJIS = { rock: '🪨', paper: '📄', scissors: '✂️' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock, Paper, Scissors for coins')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to wager').setMinValue(1).setRequired(true))
    .addStringOption(opt =>
      opt.setName('move')
        .setDescription('Your move')
        .addChoices(
          { name: 'Rock 🪨', value: 'rock' },
          { name: 'Paper 📄', value: 'paper' },
          { name: 'Scissors ✂️', value: 'scissors' }
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const playerMove = interaction.options.getString('move');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const eco = await db.economy.get(guildId, userId);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';

    if ((eco.wallet || 0) < bet) {
      return interaction.reply({ content: `❌ You do not have enough coins in your wallet! (Balance: ${(eco.wallet || 0).toLocaleString()})`, ephemeral: true });
    }

    const botMove = CHOICES[Math.floor(Math.random() * CHOICES.length)];

    let result = 'tie';
    if (
      (playerMove === 'rock' && botMove === 'scissors') ||
      (playerMove === 'paper' && botMove === 'rock') ||
      (playerMove === 'scissors' && botMove === 'paper')
    ) {
      result = 'win';
      eco.wallet += bet;
    } else if (playerMove !== botMove) {
      result = 'lose';
      eco.wallet -= bet;
    }

    await db.economy.save(guildId, userId, eco);

    const isWin = result === 'win';
    const isTie = result === 'tie';

    const embed = new EmbedBuilder()
      .setTitle('✂️ Rock Paper Scissors')
      .setColor(isWin ? '#57F287' : (isTie ? '#FEE75C' : '#ED4245'))
      .setDescription(
        `**You:** ${EMOJIS[playerMove]} ${playerMove.toUpperCase()}\n` +
        `**Bot:** ${EMOJIS[botMove]} ${botMove.toUpperCase()}\n\n` +
        (isWin
          ? `🎉 **You won ${symbol} ${bet.toLocaleString()}!**`
          : (isTie ? `🤝 **It's a draw! No coins lost.**` : `💀 **You lost ${symbol} ${bet.toLocaleString()}!**`))
      )
      .addFields({ name: 'Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
