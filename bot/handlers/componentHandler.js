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

    // --- B. TICKET CREATION (ticket_create:category) ---
    if (customId.startsWith('ticket_create:')) {
      const categoryKey = customId.split(':')[1] || 'general';
      const guild = interaction.guild;
      const user = interaction.user;

      const guildSettings = await db.guilds.get(guild.id);
      const ticketsConfig = guildSettings.tickets || {};

      // Check for already existing open ticket for this user in this guild
      const openTickets = await db.tickets.list(guild.id);
      const existing = openTickets.find(t => t.userId === user.id && t.status === 'open');
      if (existing) {
        const existingChan = guild.channels.cache.get(existing.channelId);
        if (existingChan) {
          return interaction.reply({ content: `⚠️ You already have an open ticket in ${existingChan}!`, ephemeral: true });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const ticketId = `ticket-${Date.now().toString().substring(7)}`;
        const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}`;

        const supportRoleId = ticketsConfig.supportRoleId;
        const permissionOverwrites = [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          },
          {
            id: guild.client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ];

        if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
          permissionOverwrites.push({
            id: supportRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          });
        }

        const channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketsConfig.categoryId || undefined,
          permissionOverwrites
        });

        const ticketDoc = await db.tickets.create({
          id: ticketId,
          guildId: guild.id,
          channelId: channel.id,
          userId: user.id,
          userName: user.tag,
          category: categoryKey,
          status: 'open',
          claimedBy: null
        });

        // Send initial controls embed in ticket channel
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`🎫 Ticket: ${categoryKey.toUpperCase()}`)
          .setDescription(`Hello ${user}, thank you for reaching out!\nA staff member will be with you shortly. Please describe your inquiry in detail.`)
          .setColor('#5865F2')
          .addFields(
            { name: 'Created By', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Category', value: categoryKey, inline: true },
            { name: 'Status', value: '🟢 Open', inline: true }
          )
          .setTimestamp();

        const controlRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_claim:${ticketId}`).setLabel('Claim Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`ticket_close:${ticketId}`).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${user} ${supportRoleId ? `<@&${supportRoleId}>` : ''}`, embeds: [welcomeEmbed], components: [controlRow] });

        return interaction.editReply({ content: `✅ Ticket created: ${channel}` });
      } catch (err) {
        logger.error('Failed to create ticket channel', err, 'TICKETS');
        return interaction.editReply({ content: '❌ Failed to create ticket channel. Check bot permissions.' });
      }
    }

    // --- C. TICKET CLAIM (ticket_claim:ticketId) ---
    if (customId.startsWith('ticket_claim:')) {
      const ticketId = customId.split(':')[1];
      const ticket = await db.tickets.get(ticketId);
      if (!ticket) {
        return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });
      }

      await db.tickets.update(ticketId, { claimedBy: interaction.user.tag });

      const claimEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setDescription(`🙋‍♂️ **Ticket Claimed:** ${interaction.user} will be assisting with this ticket.`);

      await interaction.reply({ embeds: [claimEmbed] });
      return;
    }

    // --- D. TICKET CLOSE & HTML TRANSCRIPT EXPORT (ticket_close:ticketId) ---
    if (customId.startsWith('ticket_close:')) {
      const ticketId = customId.split(':')[1];
      const ticket = await db.tickets.get(ticketId);
      if (!ticket) {
        return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });
      }

      await interaction.reply({ content: '🔒 **Generating HTML transcript and closing ticket in 5 seconds...**' });

      try {
        const transcriptHtml = await generateHtmlTranscript(interaction.channel, ticket, interaction.guild);

        await db.tickets.update(ticketId, {
          status: 'closed',
          closedBy: interaction.user.tag,
          closedAt: Date.now(),
          transcriptHtml
        });

        // Log transcript to configured log channel
        const guildSettings = await db.guilds.get(interaction.guild.id);
        const logChanId = guildSettings.tickets?.logChannelId || guildSettings.logging?.logChannelId;
        if (logChanId) {
          const logChan = interaction.guild.channels.cache.get(logChanId);
          if (logChan && logChan.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📁 Ticket Closed & Archived')
              .setColor('#ED4245')
              .addFields(
                { name: 'Ticket ID', value: ticketId, inline: true },
                { name: 'User', value: `${ticket.userName} (<@${ticket.userId}>)`, inline: true },
                { name: 'Closed By', value: `${interaction.user.tag}`, inline: true },
                { name: 'Dashboard View', value: `Available in web dashboard under Tickets module`, inline: false }
              )
              .setTimestamp();

            await logChan.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        // Wait 5 seconds and delete channel
        setTimeout(async () => {
          await interaction.channel.delete('Ticket closed').catch(() => {});
        }, 5000);

      } catch (err) {
        logger.error('Failed to close ticket & export transcript', err, 'TICKETS');
      }
      return;
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
