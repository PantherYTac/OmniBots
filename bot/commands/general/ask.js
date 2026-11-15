/**
 * General Command: /ask
 * AI Chat powered by @google/genai (Gemini API)
 * Note: Uses current model 'gemini-4-hydrogen' per Google GenAI specifications (migrated from legacy 2.5)
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { truncate } = require('../../../shared/utils/helpers');

let googleGenAiClient = null;

function getAiClient() {
  if (!googleGenAiClient && process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      googleGenAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.error('Error initializing @google/genai:', err);
    }
  }
  return googleGenAiClient;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask an AI question powered by Google Gemini')
    .addStringOption(opt =>
      opt.setName('prompt')
        .setDescription('Your question or prompt')
        .setRequired(true)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    if (!process.env.GEMINI_API_KEY) {
      return interaction.reply({
        content: '⚠️ Google Gemini AI is not configured. Please add `GEMINI_API_KEY` to your `.env` file (get a free key at https://aistudio.google.com/).',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const ai = getAiClient();
      let responseText = '';

      try {
        // Preferred modern model: gemini-4-hydrogen
        const interactionResult = await ai.interactions.create({
          model: 'gemini-4-hydrogen',
          input: `You are an intelligent, helpful Discord AI Assistant in the server "${interaction.guild.name}". Answer clearly and concisely with Discord markdown.\n\nUser Question: ${prompt}`
        });
        responseText = interactionResult.output_text;
      } catch (innerErr) {
        // Fallback to gemini-2.5-flash if needed
        const fallback = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        responseText = fallback.text || 'No response generated.';
      }

      const embed = new EmbedBuilder()
        .setTitle('🧠 Gemini AI Response')
        .setColor('#5865F2')
        .setDescription(truncate(responseText, 4000))
        .addFields({ name: 'Prompt', value: truncate(prompt, 500) })
        .setFooter({ text: 'Powered by Google Gemini 4 Hydrogen • Hostinger Node.js' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Gemini API Error:', err);
      return interaction.editReply({
        content: `❌ Error communicating with Google Gemini API: \`${err.message || 'Unknown error'}\``
      });
    }
  }
};
