/**
 * Application Command: /application-panel [form_id]
 * Deploy an interactive staff application panel to a channel
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application-panel')
    .setDescription('Deploy a staff application panel with an Apply button')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send panel in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(opt =>
      opt.setName('form_id')
        .setDescription('ID of application form from dashboard (optional)')
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  aliases: ['app-panel', 'apppanel'],
  module: 'applications',

  async execute(ctx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return ctx.reply({ content: '🚫 You need `Manage Server` permissions to deploy application panels.', ephemeral: true });
    }

    const targetChannel = ctx.options.getChannel('channel') || ctx.channel;
    const formId = ctx.options.getString('form_id');

    const botId = ctx.client.botId || 'primary';
    const forms = await db.applicationForms.list(ctx.guild.id, botId);

    let form = null;
    if (formId) {
      form = forms.find(f => f.id === formId || f.formId === formId);
    }
    if (!form && forms.length > 0) {
      form = forms[0];
    }

    if (!form) {
      return ctx.reply({ content: '❌ No application forms found. Please create one in the dashboard first.', ephemeral: true });
    }

    const embedCfg = form.panelEmbed || {};
    const embed = new EmbedBuilder()
      .setTitle(embedCfg.title || `🛡️ ${form.name}`)
      .setDescription(embedCfg.description || form.description || 'Click the button below to submit your application.')
      .setColor(embedCfg.color || '#5865F2')
      .setFooter({ text: 'Applications are reviewed privately by server leadership' })
      .setTimestamp();

    if (embedCfg.bannerUrl) embed.setImage(embedCfg.bannerUrl);

    const button = new ButtonBuilder()
      .setCustomId(`app_apply:${form.id}`)
      .setLabel(embedCfg.buttonText || 'Apply Now')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!form.isOpen);

    const row = new ActionRowBuilder().addComponents(button);

    const sentMessage = await targetChannel.send({ embeds: [embed], components: [row] });

    await db.applicationForms.save(form.id, {
      panelChannelId: targetChannel.id,
      panelMessageId: sentMessage.id
    });

    return ctx.reply({
      content: `✅ Application panel for **${form.name}** successfully deployed to ${targetChannel}!`,
      ephemeral: true
    });
  }
};
