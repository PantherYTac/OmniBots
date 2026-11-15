/**
 * Temporary Join-to-Create Voice Channel Manager
 */

const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

// Map of temporary channel ID -> owner ID
const activeTempChannels = new Map();

async function handleVoiceState(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const guildSettings = await db.guilds.get(guild.id);
  if (!guildSettings.modules?.tempVoice || !guildSettings.tempVoice?.enabled) return;

  const masterChannelId = guildSettings.tempVoice.creatorChannelId;
  const categoryId = guildSettings.tempVoice.categoryChannelId;

  // 1. Check if user joined the master "Join to Create" channel
  if (newState.channelId && newState.channelId === masterChannelId) {
    try {
      const member = newState.member;
      const channelName = `🔊 ${member.displayName}'s Room`;

      const newVoice = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryId || undefined,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.MuteMembers,
              PermissionsBitField.Flags.DeafenMembers,
              PermissionsBitField.Flags.MoveMembers
            ]
          }
        ]
      });

      // Move member into new voice channel
      await member.voice.setChannel(newVoice);
      activeTempChannels.set(newVoice.id, member.id);

      // Send Control Panel Embed into the voice text chat
      const panelEmbed = new EmbedBuilder()
        .setTitle('🎙️ Temp Voice Channel Controls')
        .setDescription(`Welcome to your private room, ${member}!\nUse the interactive controls below to manage your channel settings:`)
        .setColor('#5865F2')
        .addFields(
          { name: '🔒 Lock / Unlock', value: 'Toggle channel access for others', inline: true },
          { name: '👥 User Limit', value: 'Set maximum user capacity', inline: true },
          { name: '✏️ Rename', value: 'Change your channel room title', inline: true }
        )
        .setFooter({ text: 'This room will automatically delete when empty.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vc_ctrl:lock:${newVoice.id}`).setLabel('Lock/Unlock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vc_ctrl:limit:${newVoice.id}`).setLabel('Set Limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vc_ctrl:rename:${newVoice.id}`).setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary)
      );

      await newVoice.send({ embeds: [panelEmbed], components: [row] }).catch(() => {});

    } catch (err) {
      logger.error('Failed to create Join-to-Create voice channel', err, 'TEMP_VOICE');
    }
  }

  // 2. Check if a temp voice channel became empty and delete it
  if (oldState.channelId && activeTempChannels.has(oldState.channelId)) {
    const oldChannel = oldState.channel;
    if (oldChannel && oldChannel.members.size === 0) {
      activeTempChannels.delete(oldState.channelId);
      await oldChannel.delete('Temp voice channel empty').catch(() => {});
    }
  }
}

module.exports = {
  handleVoiceState,
  activeTempChannels
};
