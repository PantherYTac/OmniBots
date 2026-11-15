/**
 * Community Command: /set-birthday
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-birthday')
    .setDescription('Register your birthday for automatic server announcements')
    .addIntegerOption(opt =>
      opt.setName('month')
        .setDescription('Your birth month (1-12)')
        .setMinValue(1)
        .setMaxValue(12)
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('day')
        .setDescription('Your birth day (1-31)')
        .setMinValue(1)
        .setMaxValue(31)
        .setRequired(true)
    ),

  async execute(interaction) {
    const month = interaction.options.getInteger('month');
    const day = interaction.options.getInteger('day');

    const guildSettings = await db.guilds.get(interaction.guild.id);
    if (!guildSettings.birthdays) guildSettings.birthdays = {};
    guildSettings.birthdays[interaction.user.id] = { month, day, username: interaction.user.tag };

    await db.guilds.set(interaction.guild.id, guildSettings);

    const monthStr = MONTH_NAMES[month - 1];

    const embed = new EmbedBuilder()
      .setTitle('🎂 Birthday Registered!')
      .setColor('#5865F2')
      .setDescription(`Your birthday is saved as **${monthStr} ${day}**.\nThe server will announce and celebrate with you on your special day!`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
