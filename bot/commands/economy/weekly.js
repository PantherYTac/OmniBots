/**
 * Economy Command: /weekly
 * Claim weekly coin reward (7 day cooldown)
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const WEEKLY_AMOUNT = 2500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = {
  module: 'economy',
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claim your weekly credit allowance (2,500 coins)'),

  async execute(ctx) {
    const userEco = await db.economy.get(ctx.guild.id, ctx.user.id);
    const now = Date.now();
    const lastWeekly = userEco.lastWeekly || 0;
    const diff = now - lastWeekly;

    if (diff < WEEK_MS) {
      const remainingMs = WEEK_MS - diff;
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      return ctx.reply({
        content: `⏳ You have already claimed your weekly reward! Come back in **${days}d ${hours}h**.`,
        ephemeral: true
      });
    }

    userEco.wallet = (userEco.wallet || 0) + WEEKLY_AMOUNT;
    userEco.lastWeekly = now;
    await db.economy.save(ctx.guild.id, ctx.user.id, userEco);

    const embed = new EmbedBuilder()
      .setTitle('💰 Weekly Allowance Claimed!')
      .setColor('#57F287')
      .setDescription(`You claimed your weekly reward of **${WEEKLY_AMOUNT.toLocaleString()} coins**!`)
      .addFields(
        { name: 'New Wallet Balance', value: `🪙 ${userEco.wallet.toLocaleString()}`, inline: true },
        { name: 'Bank Balance', value: `🏦 ${(userEco.bank || 0).toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'Claim again in 7 days' })
      .setTimestamp();

    return ctx.reply({ embeds: [embed] });
  }
};