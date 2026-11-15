/**
 * General Command: /poll
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a community vote poll with reaction emojis')
    .addStringOption(opt => opt.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption(opt => opt.setName('option1').setDescription('First option').setRequired(true))
    .addStringOption(opt => opt.setName('option2').setDescription('Second option').setRequired(true))
    .addStringOption(opt => opt.setName('option3').setDescription('Third option'))
    .addStringOption(opt => opt.setName('option4').setDescription('Fourth option')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const opt1 = interaction.options.getString('option1');
    const opt2 = interaction.options.getString('option2');
    const opt3 = interaction.options.getString('option3');
    const opt4 = interaction.options.getString('option4');

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const options = [opt1, opt2, opt3, opt4].filter(Boolean);

    let desc = '';
    options.forEach((opt, idx) => {
      desc += `${emojis[idx]} **${opt}**\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(desc)
      .setColor('#5865F2')
      .setFooter({ text: `Created by ${interaction.user.tag}` })
      .setTimestamp();

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await reply.react(emojis[i]).catch(() => {});
    }
  }
};
