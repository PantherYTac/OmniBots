/**
 * Community Commands: /suggest and /suggestion-decide
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a server suggestion or decide on a suggestion (Staff)')
    .addSubcommand(sub =>
      sub
        .setName('submit')
        .setDescription('Submit a suggestion for the server')
        .addStringOption(opt => opt.setName('idea').setDescription('Describe your suggestion in detail').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('decide')
        .setDescription('Approve or deny a community suggestion (Staff only)')
        .addStringOption(opt => opt.setName('suggestion_id').setDescription('ID of the suggestion').setRequired(true))
        .addStringOption(opt =>
          opt.setName('decision')
            .setDescription('Staff decision')
            .addChoices({ name: 'Approve', value: 'approved' }, { name: 'Deny', value: 'denied' })
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for decision'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildSettings = await db.guilds.get(interaction.guild.id);

    if (sub === 'submit') {
      const idea = interaction.options.getString('idea');
      const sugChanId = guildSettings.suggestions?.channelId || interaction.channel.id;
      const targetChannel = interaction.guild.channels.cache.get(sugChanId) || interaction.channel;

      const sugId = `sug_${Date.now().toString().substring(7)}`;

      const embed = new EmbedBuilder()
        .setTitle(`💡 Suggestion #${sugId}`)
        .setDescription(idea)
        .setColor('#5865F2')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: '👍 Upvotes', value: '0', inline: true },
          { name: '👎 Downvotes', value: '0', inline: true },
          { name: 'Status', value: '🟡 Pending Review', inline: true }
        )
        .setFooter({ text: `ID: ${sugId}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sug_vote:${sugId}:up`).setLabel('0').setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sug_vote:${sugId}:down`).setLabel('0').setEmoji('👎').setStyle(ButtonStyle.Danger)
      );

      const sentMsg = await targetChannel.send({ embeds: [embed], components: [row] });

      await db.suggestions.create({
        id: sugId,
        guildId: interaction.guild.id,
        channelId: targetChannel.id,
        messageId: sentMsg.id,
        userId: interaction.user.id,
        content: idea,
        status: 'pending'
      });

      return interaction.reply({
        content: `✅ Suggestion posted in ${targetChannel}! (ID: \`${sugId}\`)`,
        ephemeral: true
      });
    }

    if (sub === 'decide') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: '❌ You need Manage Server permission to decide on suggestions.', ephemeral: true });
      }

      const sugId = interaction.options.getString('suggestion_id').trim();
      const decision = interaction.options.getString('decision');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const sug = await db.suggestions.get(sugId);
      if (!sug) {
        return interaction.reply({ content: `❌ Suggestion \`${sugId}\` not found.`, ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(sug.channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Suggestion channel could not be found.', ephemeral: true });
      }

      const msg = await channel.messages.fetch(sug.messageId).catch(() => null);
      if (!msg) {
        return interaction.reply({ content: '❌ Original suggestion message was deleted or not found.', ephemeral: true });
      }

      const isApproved = decision === 'approved';
      const statusText = isApproved ? '🟢 Approved' : '🔴 Denied';
      const statusColor = isApproved ? '#57F287' : '#ED4245';

      const oldEmbed = msg.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(statusColor)
        .setFields(
          { name: '👍 Upvotes', value: `${(sug.upvotes || []).length}`, inline: true },
          { name: '👎 Downvotes', value: `${(sug.downvotes || []).length}`, inline: true },
          { name: 'Status', value: statusText, inline: true },
          { name: `Staff Note (${interaction.user.tag})`, value: reason, inline: false }
        );

      await msg.edit({ embeds: [updatedEmbed], components: [] });
      await db.suggestions.update(sugId, { status: decision, staffReason: reason, decidedBy: interaction.user.tag });

      return interaction.reply({
        content: `✅ Suggestion \`${sugId}\` marked as **${decision.toUpperCase()}**.`,
        ephemeral: true
      });
    }
  }
};
