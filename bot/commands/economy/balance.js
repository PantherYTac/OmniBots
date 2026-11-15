/**
 * Economy Command: /balance
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check wallet and bank balance')
    .addUserOption(opt => opt.setName('user').setDescription('User whose balance to check')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const eco = await db.economy.get(interaction.guild.id, targetUser.id);
    const settings = await db.guilds.get(interaction.guild.id);
    const symbol = settings.economy?.currencySymbol || '🪙';

    const embed = new EmbedBuilder()
      .setTitle(`💳 ${targetUser.username}'s Bank Account`)
      .setColor('#5865F2')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Wallet', value: `${symbol} **${(eco.wallet || 0).toLocaleString()}**`, inline: true },
        { name: 'Bank', value: `${symbol} **${(eco.bank || 0).toLocaleString()}**`, inline: true },
        { name: 'Net Worth', value: `${symbol} **${((eco.wallet || 0) + (eco.bank || 0)).toLocaleString()}**`, inline: true },
        { name: 'Daily Streak', value: `🔥 **${eco.dailyStreak || 0} days**`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
