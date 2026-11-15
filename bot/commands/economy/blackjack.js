/**
 * Economy Minigame: /blackjack
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function drawCard() {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const val = VALUES[Math.floor(Math.random() * VALUES.length)];
  return { val, suit, text: `${val}${suit}` };
}

function calculateHand(hand) {
  let score = 0;
  let aces = 0;

  for (const card of hand) {
    if (['J', 'Q', 'K'].includes(card.val)) {
      score += 10;
    } else if (card.val === 'A') {
      aces += 1;
      score += 11;
    } else {
      score += parseInt(card.val, 10);
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }

  return score;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play a hand of Blackjack against the bot dealer')
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

    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    let playerScore = calculateHand(playerHand);
    let dealerScore = calculateHand(dealerHand);

    // Initial natural Blackjack
    if (playerScore === 21) {
      const winnings = Math.floor(bet * 1.5);
      eco.wallet += winnings;
      await db.economy.save(guildId, userId, eco);

      const embed = new EmbedBuilder()
        .setTitle('🃏 Blackjack — Natural 21!')
        .setColor('#57F287')
        .setDescription(`Your Hand: ${playerHand.map(c => c.text).join(' ')} (Score: **21**)\nDealer: ${dealerHand.map(c => c.text).join(' ')} (Score: **${dealerScore}**)\n\n🎉 **Blackjack! You won ${symbol} ${winnings.toLocaleString()}!**`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🃏 Blackjack Table')
      .setColor('#5865F2')
      .addFields(
        { name: 'Your Hand', value: `${playerHand.map(c => c.text).join(' ')} (Score: **${playerScore}**)`, inline: false },
        { name: 'Dealer Hand', value: `${dealerHand[0].text} 🂠`, inline: false },
        { name: 'Wager', value: `${symbol} ${bet.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'Click Hit to draw another card, or Stand to hold.' });

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId === 'bj_hit') {
        playerHand.push(drawCard());
        playerScore = calculateHand(playerHand);

        if (playerScore > 21) {
          collector.stop('bust');
          eco.wallet -= bet;
          await db.economy.save(guildId, userId, eco);

          const bustEmbed = new EmbedBuilder()
            .setTitle('💥 Bust! You went over 21')
            .setColor('#ED4245')
            .setDescription(`Your Hand: ${playerHand.map(c => c.text).join(' ')} (Score: **${playerScore}**)\n\n💀 **You lost ${symbol} ${bet.toLocaleString()}.**`)
            .setTimestamp();

          return i.update({ embeds: [bustEmbed], components: [] });
        }

        const hitEmbed = new EmbedBuilder()
          .setTitle('🃏 Blackjack Table')
          .setColor('#5865F2')
          .addFields(
            { name: 'Your Hand', value: `${playerHand.map(c => c.text).join(' ')} (Score: **${playerScore}**)`, inline: false },
            { name: 'Dealer Hand', value: `${dealerHand[0].text} 🂠`, inline: false }
          );

        return i.update({ embeds: [hitEmbed], components: [row] });
      }

      if (i.customId === 'bj_stand') {
        collector.stop('stand');

        // Dealer draws until 17 or more
        while (dealerScore < 17) {
          dealerHand.push(drawCard());
          dealerScore = calculateHand(dealerHand);
        }

        let won = false;
        let tie = false;

        if (dealerScore > 21 || playerScore > dealerScore) {
          won = true;
          eco.wallet += bet;
        } else if (playerScore === dealerScore) {
          tie = true;
        } else {
          eco.wallet -= bet;
        }

        await db.economy.save(guildId, userId, eco);

        const resultColor = won ? '#57F287' : (tie ? '#FEE75C' : '#ED4245');
        const outcomeMsg = won
          ? `🎉 **You beat the dealer and won ${symbol} ${bet.toLocaleString()}!**`
          : (tie ? `🤝 **Push (Tie)! Your bet of ${symbol} ${bet.toLocaleString()} was returned.**` : `💀 **Dealer wins. You lost ${symbol} ${bet.toLocaleString()}.**`);

        const finishEmbed = new EmbedBuilder()
          .setTitle('🃏 Blackjack Final Result')
          .setColor(resultColor)
          .setDescription(`**Your Hand:** ${playerHand.map(c => c.text).join(' ')} (Score: **${playerScore}**)\n**Dealer Hand:** ${dealerHand.map(c => c.text).join(' ')} (Score: **${dealerScore}**)\n\n${outcomeMsg}`)
          .setTimestamp();

        return i.update({ embeds: [finishEmbed], components: [] });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        response.edit({ components: [] }).catch(() => {});
      }
    });
  }
};
