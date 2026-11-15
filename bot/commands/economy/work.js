/**
 * Economy Command: /work
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const WORK_JOBS = [
  'delivered packages for Discord Express',
  'fixed bugs in a client\'s Discord bot',
  'designed server banner graphics',
  'moderated a busy gaming server',
  'hosted a lively community trivia night',
  'mined crypto in the digital mines',
  'brewed coffee at the programmer cafe'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a quick job to earn coins'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const eco = await db.economy.get(guildId, userId);
    const settings = await db.guilds.get(guildId);
    const symbol = settings.economy?.currencySymbol || '🪙';
    const cooldownMs = (settings.economy?.workCooldownMinutes || 30) * 60 * 1000;

    const now = Date.now();
    const lastWork = eco.lastWork || 0;

    if (now - lastWork < cooldownMs) {
      const availableAt = Math.floor((lastWork + cooldownMs) / 1000);
      return interaction.reply({
        content: `😴 You are tired from your last job! You can work again <t:${availableAt}:R>.`,
        ephemeral: true
      });
    }

    const min = settings.economy?.workMin || 50;
    const max = settings.economy?.workMax || 150;
    const earnings = Math.floor(Math.random() * (max - min + 1)) + min;
    const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)];

    eco.wallet = (eco.wallet || 0) + earnings;
    eco.lastWork = now;

    await db.economy.save(guildId, userId, eco);

    const embed = new EmbedBuilder()
      .setTitle('💼 Work Completed!')
      .setColor('#57F287')
      .setDescription(`You ${job} and earned **${symbol} ${earnings.toLocaleString()}**!`)
      .addFields({ name: 'Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
