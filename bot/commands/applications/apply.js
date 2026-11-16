/**
 * Application Command: /apply [position]
 * Apply for an open staff or community position
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { db } = require('../../../shared');
const { startApplication } = require('../../handlers/applicationHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply for open server staff or community roles')
    .addStringOption(opt =>
      opt.setName('position')
        .setDescription('Name or ID of position to apply for (optional)')
        .setRequired(false)
    ),
  aliases: ['application', 'applyfor'],
  module: 'applications',

  async execute(ctx) {
    const botId = ctx.client.botId || 'primary';
    const forms = await db.applicationForms.list(ctx.guild.id, botId);
    const openForms = forms.filter(f => f.isOpen !== false);

    if (openForms.length === 0) {
      return ctx.reply({
        content: '🔒 There are currently no open staff or community applications available on this server.',
        ephemeral: true
      });
    }

    const posInput = ctx.options.getString('position');
    if (posInput) {
      const match = openForms.find(f =>
        f.id.toLowerCase() === posInput.toLowerCase() ||
        f.formId?.toLowerCase() === posInput.toLowerCase() ||
        f.name.toLowerCase().includes(posInput.toLowerCase())
      );

      if (match) {
        if (ctx.isSlash) {
          return startApplication(ctx.interaction, match.id);
        } else {
          return ctx.reply({
            content: `Click below to start your application for **${match.name}**:`,
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`app_apply:${match.id}`)
                  .setLabel(`Apply for ${match.name}`)
                  .setStyle(ButtonStyle.Primary)
              )
            ]
          });
        }
      }
    }

    // If only one form is open, offer it directly
    if (openForms.length === 1) {
      const form = openForms[0];
      if (ctx.isSlash) {
        return startApplication(ctx.interaction, form.id);
      } else {
        return ctx.reply({
          content: `Click below to apply for **${form.name}**:`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`app_apply:${form.id}`)
                .setLabel(form.panelEmbed?.buttonText || 'Apply Now')
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });
      }
    }

    // Multiple forms open: show selection menu
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Available Server Application Positions')
      .setColor('#5865F2')
      .setDescription('Please select which staff or community position you would like to apply for:')
      .setFooter({ text: 'Select an option to begin' });

    const select = new StringSelectMenuBuilder()
      .setCustomId('app_select_position')
      .setPlaceholder('Choose a position to apply for...')
      .addOptions(
        openForms.slice(0, 25).map(f => ({
          label: f.name.substring(0, 100),
          description: (f.description || 'Open position').substring(0, 100),
          value: f.id
        }))
      );

    return ctx.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }
};
