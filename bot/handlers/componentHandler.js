/**
 * Persistent UI Component Registry & Router (discord.js v14)
 * Handles Buttons, Select Menus, and Modals
 */

const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');
const { generateHtmlTranscript } = require('../utils/transcriptGenerator');
const {
  handleTicketCategoryClick,
  handleTicketModalSubmit,
  handleTicketButtonAction,
  handleTicketCloseModal
} = require('./ticketHandler');
const {
  startApplication,
  handleApplicationModalSubmit,
  handleDmInterviewInteraction,
  handleStaffReviewAction,
  handleStaffDecisionModal
} = require('./applicationHandler');

async function handleInteraction(interaction) {
  // 1. Handle Buttons & Select Menus
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const customId = interaction.customId;

    // --- A. REACTION & BUTTON ROLES (rr:roleId:mode:group) ---
    if (customId.startsWith('rr:')) {
      const parts = customId.split(':');
      const roleId = parts[1];
      const mode = parts[2] || 'normal';
      const group = parts[3] || 'default';

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        return interaction.reply({ content: '❌ This role no longer exists.', ephemeral: true });
      }

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      try {
        if (mode === 'verify') {
          if (!hasRole) {
            await member.roles.add(role);
            return interaction.reply({ content: `✅ Verified! Granted role **${role.name}**.`, ephemeral: true });
          } else {
            return interaction.reply({ content: `ℹ️ You already have the **${role.name}** role.`, ephemeral: true });
          }
        }

        if (mode === 'unique') {
          // Remove other roles in the same panel if specified
          const guildSettings = await db.guilds.get(interaction.guild.id);
          const panel = (guildSettings.reactionRoles || []).find(p => p.roles?.some(r => r.roleId === roleId));
          if (panel && Array.isArray(panel.roles)) {
            for (const r of panel.roles) {
              if (r.roleId !== roleId && member.roles.cache.has(r.roleId)) {
                await member.roles.remove(r.roleId).catch(() => {});
              }
            }
          }
          await member.roles.add(role);
          return interaction.reply({ content: `✅ Set your exclusive role to **${role.name}**.`, ephemeral: true });
        }

        if (mode === 'temp') {
          await member.roles.add(role);
          setTimeout(async () => {
            const m = await interaction.guild.members.fetch(member.id).catch(() => null);
            if (m && m.roles.cache.has(roleId)) {
              await m.roles.remove(role).catch(() => {});
            }
          }, 60 * 60 * 1000); // 1 hour temporary role
          return interaction.reply({ content: `⏳ Granted temporary role **${role.name}** for 1 hour.`, ephemeral: true });
        }

        // Default 'normal' toggle
        if (hasRole) {
          await member.roles.remove(role);
          return interaction.reply({ content: `➖ Removed role **${role.name}**.`, ephemeral: true });
        } else {
          await member.roles.add(role);
          return interaction.reply({ content: `➕ Added role **${role.name}**.`, ephemeral: true });
        }
      } catch (err) {
        logger.error('Failed to update reaction role for user', err, 'REACTION_ROLE');
        return interaction.reply({ content: '❌ Failed to update role. Please ensure the bot role is positioned higher than the assigned role.', ephemeral: true });
      }
    }

    // --- B. TICKET INTERACTIONS ---
    if (customId.startsWith('ticket_create:')) {
      const categoryId = customId.split(':')[1] || 'general';
      return handleTicketCategoryClick(interaction, categoryId);
    }

    if (customId === 'ticket_select_category' && interaction.isStringSelectMenu()) {
      const categoryId = interaction.values[0];
      return handleTicketCategoryClick(interaction, categoryId);
    }

    if (
      customId.startsWith('ticket_claim:') ||
      customId.startsWith('ticket_lock:') ||
      customId.startsWith('ticket_close_prompt:') ||
      customId.startsWith('ticket_close_confirm:') ||
      customId.startsWith('ticket_close_cancel:') ||
      customId.startsWith('ticket_close_reason_btn:') ||
      customId.startsWith('ticket_delete:')
    ) {
      return handleTicketButtonAction(interaction);
    }

    // --- C. STAFF & COMMUNITY APPLICATIONS ---
    if (customId.startsWith('app_apply:')) {
      const formId = customId.split(':')[1];
      return startApplication(interaction, formId);
    }

    if (customId === 'app_select_position' && interaction.isStringSelectMenu()) {
      const formId = interaction.values[0];
      return startApplication(interaction, formId);
    }

    if (
      customId.startsWith('app_vote:') ||
      customId.startsWith('app_accept_prompt:') ||
      customId.startsWith('app_deny_prompt:') ||
      customId.startsWith('app_interview:')
    ) {
      return handleStaffReviewAction(interaction);
    }

    if (customId === 'app_dm_cancel' || customId.startsWith('app_dm_choice:')) {
      return handleDmInterviewInteraction(interaction);
    }

    // --- E. VERIFICATION GATE (verify_gate:verify) ---
    if (customId === 'verify_gate:verify') {
      const guildSettings = await db.guilds.get(interaction.guild.id);
      const verifiedRoleId = guildSettings.verification?.verifiedRoleId;

      if (!verifiedRoleId) {
        return interaction.reply({ content: '❌ Verified role is not configured in server settings.', ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(verifiedRoleId);
      if (!role) {
        return interaction.reply({ content: '❌ The configured Verified role was not found.', ephemeral: true });
      }

      if (interaction.member.roles.cache.has(verifiedRoleId)) {
        return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
      }

      await interaction.member.roles.add(role);
      return interaction.reply({ content: `🎉 **Verification successful!** You now have access as a **${role.name}**.`, ephemeral: true });
    }

    // --- F. GIVEAWAY JOIN (giveaway_join:messageId) ---
    if (customId.startsWith('giveaway_join:')) {
      const messageId = customId.split(':')[1];
      const giveaway = await db.giveaways.get(messageId);
      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
      }

      // Check role requirement
      if (giveaway.roleRequired && !interaction.member.roles.cache.has(giveaway.roleRequired)) {
        return interaction.reply({ content: `❌ You need the <@&${giveaway.roleRequired}> role to join this giveaway!`, ephemeral: true });
      }

      const userId = interaction.user.id;
      const entries = giveaway.entries || [];
      const hasJoined = entries.includes(userId);

      if (hasJoined) {
        giveaway.entries = entries.filter(id => id !== userId);
        await db.giveaways.update(messageId, { entries: giveaway.entries });
        return interaction.reply({ content: '🚪 You left the giveaway.', ephemeral: true });
      } else {
        giveaway.entries.push(userId);
        await db.giveaways.update(messageId, { entries: giveaway.entries });
        return interaction.reply({ content: `🎉 You successfully joined the giveaway! (${giveaway.entries.length} total entries)`, ephemeral: true });
      }
    }

    // --- G. SUGGESTION VOTING (sug_vote:id:up/down) ---
    if (customId.startsWith('sug_vote:')) {
      const parts = customId.split(':');
      const sugId = parts[1];
      const voteType = parts[2]; // 'up' or 'down'

      const sug = await db.suggestions.get(sugId);
      if (!sug || sug.status !== 'pending') {
        return interaction.reply({ content: '❌ This suggestion is no longer open for voting.', ephemeral: true });
      }

      const userId = interaction.user.id;
      let upvotes = sug.upvotes || [];
      let downvotes = sug.downvotes || [];

      if (voteType === 'up') {
        downvotes = downvotes.filter(id => id !== userId);
        if (upvotes.includes(userId)) upvotes = upvotes.filter(id => id !== userId);
        else upvotes.push(userId);
      } else {
        upvotes = upvotes.filter(id => id !== userId);
        if (downvotes.includes(userId)) downvotes = downvotes.filter(id => id !== userId);
        else downvotes.push(userId);
      }

      await db.suggestions.update(sugId, { upvotes, downvotes });

      // Update message embed
      const msg = await interaction.channel.messages.fetch(sug.messageId).catch(() => null);
      if (msg && msg.embeds.length > 0) {
        const oldEmbed = msg.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
          .setFields(
            { name: '👍 Upvotes', value: `${upvotes.length}`, inline: true },
            { name: '👎 Downvotes', value: `${downvotes.length}`, inline: true }
          );

        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`sug_vote:${sugId}:up`).setLabel(`${upvotes.length}`).setEmoji('👍').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`sug_vote:${sugId}:down`).setLabel(`${downvotes.length}`).setEmoji('👎').setStyle(ButtonStyle.Danger)
        );

        await msg.edit({ embeds: [updatedEmbed], components: [newRow] });
      }

      return interaction.reply({ content: '✅ Vote recorded!', ephemeral: true });
    }

    // --- H. TEMP VOICE CONTROLS (vc_ctrl:action:channelId) ---
    if (customId.startsWith('vc_ctrl:')) {
      const [, action, channelId] = customId.split(':');
      const voiceChannel = interaction.guild.channels.cache.get(channelId);
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ Voice channel not found.', ephemeral: true });
      }

      const { activeTempChannels } = require('../utils/tempVoiceManager');
      const ownerId = activeTempChannels.get(channelId);

      if (ownerId && interaction.user.id !== ownerId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: '❌ Only the room owner can manage this temporary voice channel.', ephemeral: true });
      }

      if (action === 'lock') {
        const currentPerm = voiceChannel.permissionOverwrites.cache.get(interaction.guild.id);
        const isLocked = currentPerm?.deny.has(PermissionsBitField.Flags.Connect);

        if (isLocked) {
          await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
          return interaction.reply({ content: '🔓 Voice channel is now **Unlocked** for everyone.', ephemeral: true });
        } else {
          await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
          return interaction.reply({ content: '🔒 Voice channel is now **Locked**.', ephemeral: true });
        }
      }

      if (action === 'limit') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vc_limit:${channelId}`)
          .setTitle('Set Voice Room User Limit')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('limit_val')
                .setLabel('User Limit (0 = Unlimited, max 99)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('5')
                .setRequired(true)
            )
          );
        return interaction.showModal(modal);
      }

      if (action === 'rename') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vc_rename:${channelId}`)
          .setTitle('Rename Voice Room')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('name_val')
                .setLabel('New Channel Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Chill Lounge')
                .setRequired(true)
            )
          );
        return interaction.showModal(modal);
      }
    }
  }

  // 2. Handle Modals
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    // Tickets Modals
    if (customId.startsWith('ticket_modal:')) {
      return handleTicketModalSubmit(interaction);
    }
    if (customId.startsWith('ticket_close_modal:')) {
      return handleTicketCloseModal(interaction);
    }

    // Applications Modals
    if (customId.startsWith('app_modal:')) {
      return handleApplicationModalSubmit(interaction);
    }
    if (customId.startsWith('app_accept_modal:') || customId.startsWith('app_deny_modal:')) {
      return handleStaffDecisionModal(interaction);
    }

    if (customId.startsWith('modal_vc_limit:')) {
      const channelId = customId.split(':')[1];
      const chan = interaction.guild.channels.cache.get(channelId);
      const limit = parseInt(interaction.fields.getTextInputValue('limit_val'), 10);
      if (chan && !isNaN(limit) && limit >= 0 && limit <= 99) {
        await chan.setUserLimit(limit);
        return interaction.reply({ content: `👥 User limit updated to **${limit === 0 ? 'Unlimited' : limit}**.`, ephemeral: true });
      }
      return interaction.reply({ content: '❌ Invalid limit number (must be 0-99).', ephemeral: true });
    }

    if (customId.startsWith('modal_vc_rename:')) {
      const channelId = customId.split(':')[1];
      const chan = interaction.guild.channels.cache.get(channelId);
      const newName = interaction.fields.getTextInputValue('name_val').trim();
      if (chan && newName) {
        await chan.setName(`🔊 ${newName}`);
        return interaction.reply({ content: `✏️ Room renamed to **🔊 ${newName}**.`, ephemeral: true });
      }
      return interaction.reply({ content: '❌ Invalid channel title.', ephemeral: true });
    }
  }
}

module.exports = { handleInteraction };
