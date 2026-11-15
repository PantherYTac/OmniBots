/**
 * Community Command: /afk
 * Sets member AFK status and responds when they are mentioned
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Global in-memory AFK store: Map<`${guildId}_${userId}`, { reason, timestamp }>
const afkStore = new Map();

module.exports = {
  module: 'community',
  afkStore,
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status with an optional status reason')
    .addStringOption(opt => opt.setName('reason').setDescription('Why you are going AFK').setRequired(false)),

  async execute(ctx) {
    const reason = ctx.options.getString('reason') || 'AFK (Away From Keyboard)';
    const key = `${ctx.guild.id}_${ctx.user.id}`;

    afkStore.set(key, {
      reason,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('💤 AFK Status Set')
      .setColor('#5865F2')
      .setDescription(`${ctx.user} is now marked as **AFK**: ${reason}`)
      .setFooter({ text: 'Sending any message in this server will remove your AFK status' })
      .setTimestamp();

    return ctx.reply({ embeds: [embed] });
  }
};