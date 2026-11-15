/**
 * General Command: /remindme
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseDuration, formatDuration } = require('../../../shared/utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a personal reminder timer')
    .addStringOption(opt =>
      opt.setName('time')
        .setDescription('Reminder time (e.g. 10m, 1h, 2d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reminder')
        .setDescription('What do you want to be reminded about?')
        .setRequired(true)
    ),

  async execute(interaction) {
    const timeStr = interaction.options.getString('time');
    const reminder = interaction.options.getString('reminder');
    const ms = parseDuration(timeStr);

    if (!ms || ms < 5000 || ms > 14 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Invalid time format. Please use durations like `5m`, `30m`, `2h`, `1d` (min 5s, max 14 days).',
        ephemeral: true
      });
    }

    const targetDate = new Date(Date.now() + ms);

    const embed = new EmbedBuilder()
      .setTitle('⏰ Reminder Set!')
      .setColor('#5865F2')
      .setDescription(`I will remind you about:\n**"${reminder}"**\n\n**When:** <t:${Math.floor(targetDate.getTime() / 1000)}:R>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    setTimeout(async () => {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🔔 Reminder Notification')
        .setColor('#5865F2')
        .setDescription(`Hello! You asked me to remind you:\n\n**"${reminder}"**`)
        .setFooter({ text: `Set in ${interaction.guild.name}` })
        .setTimestamp();

      const user = await interaction.client.users.fetch(interaction.user.id).catch(() => null);
      if (user) {
        user.send({ embeds: [dmEmbed] }).catch(() => {
          interaction.channel.send({ content: `${interaction.user}`, embeds: [dmEmbed] }).catch(() => {});
        });
      }
    }, ms);
  }
};
