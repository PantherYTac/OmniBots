/**
 * Economy Command: /pay
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer money from your wallet to another member')
    .addUserOption(opt => opt.setName('recipient').setDescription('The member to send coins to').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Amount of coins to send')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction) {
    const recipient = interaction.options.getUser('recipient');
    const amount = interaction.options.getInteger('amount');
    const senderId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (recipient.id === senderId) {
      return interaction.reply({ content: '❌ You cannot pay yourself.', ephemeral: true });
    }

    if (recipient.bot) {
      return interaction.reply({ content: '❌ Bots do not have wallets.', ephemeral: true });
    }

    const senderEco = await db.economy.get(guildId, senderId);
    if ((senderEco.wallet || 0) < amount) {
      return interaction.reply({ content: `❌ You do not have enough coins in your wallet. (Balance: ${(senderEco.wallet || 0).toLocaleString()})`, ephemeral: true });
    }

    const recipientEco = await db.economy.get(guildId, recipient.id);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';

    senderEco.wallet -= amount;
    recipientEco.wallet = (recipientEco.wallet || 0) + amount;

    await db.economy.save(guildId, senderId, senderEco);
    await db.economy.save(guildId, recipient.id, recipientEco);

    const embed = new EmbedBuilder()
      .setTitle('💸 Transfer Successful')
      .setColor('#57F287')
      .setDescription(`Transferred **${symbol} ${amount.toLocaleString()}** from ${interaction.user} to ${recipient}!`)
      .addFields(
        { name: 'Your New Balance', value: `${symbol} ${senderEco.wallet.toLocaleString()}`, inline: true },
        { name: `${recipient.username}'s Balance`, value: `${symbol} ${recipientEco.wallet.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
