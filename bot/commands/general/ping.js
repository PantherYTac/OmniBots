/**
 * General Command: /ping
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency, gateway heartbeat, and system health'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ fetchReply: true });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;
    const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong! System Health Status')
      .setColor('#5865F2')
      .addFields(
        { name: 'Gateway Latency', value: `\`${wsLatency}ms\``, inline: true },
        { name: 'API Roundtrip', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'Database Engine', value: `\`${db.getDriver().toUpperCase()}\``, inline: true },
        { name: 'Memory Usage', value: `\`${memoryMB} MB\``, inline: true },
        { name: 'Node.js', value: `\`${process.version}\``, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor(Date.now() / 1000 - process.uptime())}:R>`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
