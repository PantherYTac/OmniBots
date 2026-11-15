/**
 * Event: voiceStateUpdate
 * Join-to-Create temp channels, voice-linked roles, and voice audit logging
 */

const { EmbedBuilder } = require('discord.js');
const { db } = require('../../shared');
const { handleVoiceState } = require('../utils/tempVoiceManager');
const logger = require('../../shared/utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member) return;

    // 1. Join-to-Create Temporary Voice Channels
    await handleVoiceState(oldState, newState);

    const guildSettings = await db.guilds.get(guild.id);

    // 2. Voice-Linked Roles
    if (Array.isArray(guildSettings.voiceRoles) && guildSettings.voiceRoles.length > 0) {
      try {
        for (const vr of guildSettings.voiceRoles) {
          const role = guild.roles.cache.get(vr.roleId);
          if (!role) continue;

          // Joined configured voice channel
          if (newState.channelId === vr.voiceChannelId && oldState.channelId !== vr.voiceChannelId) {
            await member.roles.add(role).catch(() => {});
          }
          // Left configured voice channel
          else if (oldState.channelId === vr.voiceChannelId && newState.channelId !== vr.voiceChannelId) {
            await member.roles.remove(role).catch(() => {});
          }
        }
      } catch (err) {
        logger.error('Failed to update voice-linked roles', err, 'VOICE_ROLES');
      }
    }

    // 3. Voice Activity Audit Logging
    if (guildSettings.modules?.logging && guildSettings.logging?.enabled) {
      const logChanId = guildSettings.logging.splitChannels?.voiceLogs || guildSettings.logging.logChannelId;
      if (logChanId) {
        const logChannel = guild.channels.cache.get(logChanId);
        if (logChannel && logChannel.isTextBased()) {
          // Joined voice channel
          if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
              .setTitle('🔊 Voice Channel Joined')
              .setColor('#57F287')
              .setDescription(`${member} joined voice channel ${newState.channel}`)
              .setFooter({ text: `User ID: ${member.id}` })
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
          // Left voice channel
          else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
              .setTitle('🔇 Voice Channel Left')
              .setColor('#ED4245')
              .setDescription(`${member} left voice channel ${oldState.channel}`)
              .setFooter({ text: `User ID: ${member.id}` })
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
          // Moved voice channel
          else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
              .setTitle('🔁 Voice Channel Moved')
              .setColor('#FFA500')
              .setDescription(`${member} moved from ${oldState.channel} to ${newState.channel}`)
              .setFooter({ text: `User ID: ${member.id}` })
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    }
  }
};
