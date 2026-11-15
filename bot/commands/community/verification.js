/**
 * Community Command: /setup-verification
 * Deploys interactive verification gate panel
 */

const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Deploy a verification gate panel to protect your server from raids and bots')
    .addRoleOption(opt => opt.setName('verified_role').setDescription('Role granted upon successful verification').setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to place verification panel in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(opt => opt.setName('instructions').setDescription('Custom instructions for members'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    const verifiedRole = interaction.options.getRole('verified_role');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const instructions = interaction.options.getString('instructions') ||
      'Welcome to the server!\nTo gain access to our channels and verify that you are a human, please click the **Verify (🛡️)** button below.';

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Member Verification Gate')
      .setDescription(instructions)
      .setColor('#5865F2')
      .addFields({ name: 'Role Granted', value: `${verifiedRole}`, inline: true })
      .setFooter({ text: 'Powered by All-in-One Discord Bot Security' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_gate:verify')
        .setLabel('Verify Membership')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Success)
    );

    const panelMsg = await targetChannel.send({ embeds: [embed], components: [row] });

    const guildSettings = await db.guilds.get(interaction.guild.id);
    guildSettings.verification = {
      enabled: true,
      channelId: targetChannel.id,
      verifiedRoleId: verifiedRole.id,
      messageId: panelMsg.id
    };
    await db.guilds.set(interaction.guild.id, guildSettings);

    return interaction.reply({
      content: `✅ Verification panel successfully deployed in ${targetChannel} assigning ${verifiedRole}!`,
      ephemeral: true
    });
  }
};
