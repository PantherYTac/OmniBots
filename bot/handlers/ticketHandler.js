/**
 * Advanced Multi-Category Support Ticket Handler
 * Scoped per (botId, guildId) across all active bots
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
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');
const { generateHtmlTranscript } = require('../utils/transcriptGenerator');

/**
 * Handle Ticket Panel Category Button or Dropdown Click
 */
async function handleTicketCategoryClick(interaction, categoryId) {
  const guild = interaction.guild;
  const user = interaction.user;
  const botId = interaction.client.botId || 'primary';

  // 1. Fetch category configuration
  const category = await db.ticketCategories.get(categoryId);
  if (!category) {
    return interaction.reply({ content: '❌ Selected ticket department was not found.', ephemeral: true });
  }

  // 2. Check user's maximum open tickets for this category
  const allTickets = await db.tickets.list(guild.id, botId);
  const userOpenTickets = allTickets.filter(t => (t.openerId === user.id || t.userId === user.id) && t.status === 'open' && t.categoryId === categoryId);
  const maxOpen = category.maxOpenPerUser || 1;

  if (userOpenTickets.length >= maxOpen) {
    const existing = guild.channels.cache.get(userOpenTickets[0].channelId);
    return interaction.reply({
      content: `⚠️ You already have ${userOpenTickets.length} open ticket(s) in this department${existing ? ` (${existing})` : ''}. Maximum allowed: ${maxOpen}.`,
      ephemeral: true
    });
  }

  // 3. Pre-Open Modal Questions Check
  if (Array.isArray(category.modalQuestions) && category.modalQuestions.length > 0) {
    const questions = category.modalQuestions.slice(0, 5); // Discord modal max 5 fields
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal:${category.id}`)
      .setTitle(category.name.substring(0, 45));

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const textInput = new TextInputBuilder()
        .setCustomId(`q_${i}`)
        .setLabel((q.label || `Question ${i + 1}`).substring(0, 45))
        .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder((q.placeholder || '').substring(0, 100))
        .setRequired(q.required !== false);

      if (q.minLength) textInput.setMinLength(parseInt(q.minLength, 10));
      if (q.maxLength) textInput.setMaxLength(parseInt(q.maxLength, 10));

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    }

    return interaction.showModal(modal);
  }

  // 4. Create Ticket Channel Immediately (if no questions configured)
  await interaction.deferReply({ ephemeral: true });
  return createTicketChannel(interaction, category, []);
}

/**
 * Handle Submission of Pre-Open Ticket Modal
 */
async function handleTicketModalSubmit(interaction) {
  const categoryId = interaction.customId.split(':')[1];
  const category = await db.ticketCategories.get(categoryId);
  if (!category) {
    return interaction.reply({ content: '❌ Department configuration not found.', ephemeral: true });
  }

  const answers = [];
  const questions = (category.modalQuestions || []).slice(0, 5);
  for (let i = 0; i < questions.length; i++) {
    const answer = interaction.fields.getTextInputValue(`q_${i}`) || '';
    answers.push({
      prompt: questions[i].label || `Question ${i + 1}`,
      answer
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return createTicketChannel(interaction, category, answers);
}

/**
 * Create Ticket Private Channel & Welcome Embed
 */
async function createTicketChannel(interaction, category, answers = []) {
  const guild = interaction.guild;
  const user = interaction.user;
  const botId = interaction.client.botId || 'primary';
  const ticketsConfig = (await db.guilds.get(guild.id))?.tickets || {};

  try {
    const ticketId = `ticket-${Date.now().toString().substring(7)}`;
    const allTickets = await db.tickets.list(guild.id);
    const count = allTickets.length + 1;

    // Pattern evaluation
    let pattern = category.channelNamePattern || 'ticket-{category}-{username}-{count}';
    const cleanCategory = (category.name || 'support').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

    const channelName = pattern
      .replace(/\{category\}/g, cleanCategory)
      .replace(/\{username\}/g, cleanUsername)
      .replace(/\{count\}/g, String(count));

    // Permission Overwrites
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
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      }
    ];

    // Support Roles
    const supportRoles = Array.isArray(category.supportRoleIds) && category.supportRoleIds.length > 0
      ? category.supportRoleIds
      : (ticketsConfig.supportRoleId ? [ticketsConfig.supportRoleId] : []);

    for (const roleId of supportRoles) {
      if (guild.roles.cache.has(roleId)) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
          ]
        });
      }
    }

    const parentCategory = category.discordCategoryId || ticketsConfig.categoryId || undefined;

    const channel = await guild.channels.create({
      name: channelName.substring(0, 100),
      type: ChannelType.GuildText,
      parent: parentCategory && guild.channels.cache.has(parentCategory) ? parentCategory : undefined,
      permissionOverwrites
    });

    // Save ticket to DB
    const ticketDoc = await db.tickets.create({
      id: ticketId,
      ticketId,
      botId,
      guildId: guild.id,
      categoryId: category.id,
      channelId: channel.id,
      openerId: user.id,
      openerTag: user.tag,
      userId: user.id,
      userName: user.tag,
      status: 'open',
      answersJson: answers,
      claimedBy: null,
      claimedByTag: null,
      locked: false,
      createdAt: Date.now()
    });

    // Welcome Embed
    const welcomeCfg = category.welcomeEmbed || {};
    const welcomeTitle = (welcomeCfg.title || `🎫 ${category.name}`).replace(/\{user\}/g, user.username);
    const welcomeDesc = (welcomeCfg.description || `Welcome ${user}! Support will be with you shortly.\nPlease describe your inquiry in detail.`).replace(/\{user\}/g, `${user}`);

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(welcomeTitle)
      .setDescription(welcomeDesc)
      .setColor(welcomeCfg.color || '#5865F2')
      .addFields(
        { name: '👤 Opener', value: `${user} (\`${user.id}\`)`, inline: true },
        { name: '📂 Department', value: `${category.emoji || '🎫'} ${category.name}`, inline: true },
        { name: '🔖 Status', value: '🟢 Open & Waiting', inline: true }
      )
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: `Ticket ID: ${ticketId} • OmniBots Support Suite` })
      .setTimestamp();

    // If modal answers provided, format them in an embed
    let answersEmbed = null;
    if (answers.length > 0) {
      answersEmbed = new EmbedBuilder()
        .setTitle('📋 Pre-Ticket Questionnaire Answers')
        .setColor('#38BDF8')
        .setDescription(
          answers.map(a => `**${a.prompt}:**\n> ${a.answer || '*(No answer provided)*'}`).join('\n\n')
        );
    }

    // Persistent Action Controls
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_claim:${ticketId}`).setLabel('Claim').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_lock:${ticketId}`).setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_close_prompt:${ticketId}`).setLabel('Close').setEmoji('❌').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_delete:${ticketId}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    const mentions = [
      `${user}`,
      ...supportRoles.filter(r => guild.roles.cache.has(r)).map(r => `<@&${r}>`)
    ].join(' ');

    const embedsToSend = answersEmbed ? [welcomeEmbed, answersEmbed] : [welcomeEmbed];
    await channel.send({ content: mentions, embeds: embedsToSend, components: [controlRow] });

    return interaction.editReply({
      content: `✅ Your ticket has been created: ${channel}`
    });
  } catch (err) {
    logger.error('Failed to create ticket channel', err, 'TICKETS');
    return interaction.editReply({
      content: `❌ Failed to create ticket channel: ${err.message}. Please verify bot permissions.`
    });
  }
}

/**
 * Handle In-Ticket Action Buttons
 */
async function handleTicketButtonAction(interaction) {
  const [action, ticketId] = interaction.customId.split(':');
  const guild = interaction.guild;
  const user = interaction.user;

  const ticket = await db.tickets.get(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ Ticket record not found in database.', ephemeral: true });
  }

  // 1. CLAIM / UNCLAIM
  if (action === 'ticket_claim') {
    if (ticket.claimedBy === user.id) {
      // Unclaim
      await db.tickets.update(ticketId, { claimedBy: null, claimedByTag: null });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#8B949E')
            .setDescription(`ℹ️ ${user} has **unclaimed** this ticket. It is now open for any staff member.`)
        ]
      });
    } else {
      // Claim
      await db.tickets.update(ticketId, { claimedBy: user.id, claimedByTag: user.tag });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`🙋‍♂️ **Ticket Claimed!** ${user} is now managing this support ticket.`)
        ]
      });
    }
  }

  // 2. LOCK / UNLOCK
  if (action === 'ticket_lock') {
    const isLocked = Boolean(ticket.locked);
    const targetUserId = ticket.openerId || ticket.userId;
    const channel = interaction.channel;

    if (isLocked) {
      // Unlock
      await channel.permissionOverwrites.edit(targetUserId, { SendMessages: true });
      await db.tickets.update(ticketId, { locked: false });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`🔓 **Ticket Unlocked:** The ticket opener (<@${targetUserId}>) can now send messages again.`)
        ]
      });
    } else {
      // Lock
      await channel.permissionOverwrites.edit(targetUserId, { SendMessages: false });
      await db.tickets.update(ticketId, { locked: true });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`🔒 **Ticket Locked:** The ticket opener (<@${targetUserId}>) has been temporarily muted from sending messages.`)
        ]
      });
    }
  }

  // 3. CLOSE PROMPT
  if (action === 'ticket_close_prompt') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close_confirm:${ticketId}`).setLabel('Close Immediately').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_close_reason_btn:${ticketId}`).setLabel('Close with Reason...').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_close_cancel:${ticketId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: '⚠️ **Are you sure you want to close this ticket?** An HTML transcript will be exported and archived.',
      components: [row]
    });
  }

  // 3b. CLOSE CANCEL
  if (action === 'ticket_close_cancel') {
    return interaction.update({ content: '✅ Ticket close cancelled.', components: [] });
  }

  // 3c. CLOSE WITH REASON MODAL
  if (action === 'ticket_close_reason_btn') {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal:${ticketId}`)
      .setTitle('Close Ticket Reason')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Reason for Closing')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Resolved issue, inactivity, requested by user, etc.')
            .setRequired(false)
        )
      );
    return interaction.showModal(modal);
  }

  // 3d. CLOSE CONFIRM
  if (action === 'ticket_close_confirm') {
    return closeTicketFinal(interaction, ticketId, 'No close reason specified.');
  }

  // 4. DELETE TICKET CHANNEL
  if (action === 'ticket_delete') {
    await interaction.reply({ content: '🗑️ **Deleting ticket channel in 5 seconds...**' });
    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 5000);
    return;
  }
}

/**
 * Handle Close Ticket Modal Submit
 */
async function handleTicketCloseModal(interaction) {
  const ticketId = interaction.customId.split(':')[1];
  const reason = interaction.fields.getTextInputValue('close_reason') || 'Resolved by staff.';
  return closeTicketFinal(interaction, ticketId, reason);
}

/**
 * Execute Final Ticket Close & Transcript Export
 */
async function closeTicketFinal(interaction, ticketId, reason = 'No reason provided') {
  const channel = interaction.channel;
  const guild = interaction.guild;
  const user = interaction.user;

  const ticket = await db.tickets.get(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });
  }

  if (interaction.isModalSubmit()) {
    await interaction.reply({ content: '🔒 **Closing ticket and generating HTML transcript...**' });
  } else {
    await interaction.update({ content: '🔒 **Closing ticket and generating HTML transcript...**', components: [] });
  }

  try {
    // 1. Generate HTML Transcript
    const transcriptHtml = await generateHtmlTranscript(channel, ticket, guild);
    const transcriptBuffer = Buffer.from(transcriptHtml, 'utf8');

    // 2. Update Database Record
    await db.tickets.update(ticketId, {
      status: 'closed',
      closedBy: user.id,
      closedByTag: user.tag,
      closedAt: Date.now(),
      closeReason: reason,
      htmlTranscript: transcriptHtml,
      transcriptHtml
    });

    const category = ticket.categoryId ? await db.ticketCategories.get(ticket.categoryId) : null;
    const guildSettings = await db.guilds.get(guild.id);
    const ticketsConfig = guildSettings.tickets || {};

    // 3. Send Transcript to Ticket Log Channel
    const logChanId = ticketsConfig.logChannelId || guildSettings.logging?.logChannelId;
    if (logChanId) {
      const logChan = guild.channels.cache.get(logChanId);
      if (logChan && logChan.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`📁 Ticket Closed: #${channel.name}`)
          .setColor('#5865F2')
          .addFields(
            { name: 'Ticket ID', value: `\`${ticketId}\``, inline: true },
            { name: 'Opener', value: `<@${ticket.openerId || ticket.userId}>`, inline: true },
            { name: 'Closed By', value: `${user} (\`${user.tag}\`)`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${ticketId}.html` });
        await logChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
      }
    }

    // 4. Send Transcript DM to Ticket Opener
    const openerId = ticket.openerId || ticket.userId;
    if (openerId) {
      try {
        const openerUser = await guild.client.users.fetch(openerId).catch(() => null);
        if (openerUser) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(`📬 Your Ticket in ${guild.name} has been Closed`)
            .setColor('#5865F2')
            .setDescription(`Your ticket **#${channel.name}** has been closed.\n\n**Reason:** ${reason}\n**Closed By:** ${user.tag}`)
            .setFooter({ text: 'A copy of your HTML chat transcript is attached below.' })
            .setTimestamp();

          const dmAttachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${ticketId}.html` });
          await openerUser.send({ embeds: [dmEmbed], files: [dmAttachment] }).catch(() => {});
        }
      } catch {}
    }

    // 5. Handle Closed Category or Channel Deletion
    const closedCatId = category?.closedCategoryId;
    if (closedCatId && guild.channels.cache.has(closedCatId)) {
      await channel.setParent(closedCatId, { lockPermissions: false }).catch(() => {});
      await channel.setName(`closed-${ticket.openerTag || 'ticket'}`).catch(() => {});
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#8B949E')
            .setDescription(`📁 This ticket is now **Archived & Closed** by ${user}.\n**Reason:** ${reason}`)
        ]
      });
    } else {
      await channel.send({ content: '⏳ **This ticket will automatically be deleted in 5 seconds...**' });
      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 5000);
    }
  } catch (err) {
    logger.error('Error during ticket close workflow', err, 'TICKETS');
  }
}

module.exports = {
  handleTicketCategoryClick,
  handleTicketModalSubmit,
  handleTicketButtonAction,
  handleTicketCloseModal,
  createTicketChannel,
  closeTicketFinal
};
