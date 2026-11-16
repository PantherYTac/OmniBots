/**
 * Advanced Staff & Community Applications Handler
 * Supports Modal (1-5 text questions) and Interactive DM Step-by-Step Interview (6+ questions or choice)
 * Staff Review Queue with Upvote/Downvote tally, Accept, Deny, and Private Interview Thread creation.
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
  StringSelectMenuBuilder
} = require('discord.js');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

// In-memory active DM interviews: Map<userId, { form, currentQuestionIndex, answers: [], dmChannel, timeoutHandle }>
const activeInterviews = new Map();

/**
 * Check eligibility for an applicant
 */
async function checkApplicationEligibility(member, form) {
  const guild = member.guild;
  const user = member.user;

  // 1. Form open status
  if (!form.isOpen) {
    return { eligible: false, reason: 'Applications for this position are currently closed.' };
  }

  // 2. Minimum account age (days)
  if (form.minAccountAgeDays > 0) {
    const ageDays = (Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (ageDays < form.minAccountAgeDays) {
      return {
        eligible: false,
        reason: `Your Discord account must be at least **${form.minAccountAgeDays} days old** to apply (current: ${Math.floor(ageDays)} days).`
      };
    }
  }

  // 3. Minimum server days
  if (form.minServerDays > 0 && member.joinedTimestamp) {
    const serverDays = (Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
    if (serverDays < form.minServerDays) {
      return {
        eligible: false,
        reason: `You must be a member of this server for at least **${form.minServerDays} days** to apply (current: ${Math.floor(serverDays)} days).`
      };
    }
  }

  // 4. Blocked roles
  if (Array.isArray(form.blockedRoleIds) && form.blockedRoleIds.length > 0) {
    const hasBlocked = form.blockedRoleIds.some(r => member.roles.cache.has(r));
    if (hasBlocked) {
      return { eligible: false, reason: 'You possess a role that is ineligible to apply for this position.' };
    }
  }

  // 5. Required roles
  if (Array.isArray(form.requiredRoleIds) && form.requiredRoleIds.length > 0) {
    const hasRequired = form.requiredRoleIds.some(r => member.roles.cache.has(r));
    if (!hasRequired) {
      const roleNames = form.requiredRoleIds
        .map(id => guild.roles.cache.get(id)?.name || id)
        .join(', ');
      return { eligible: false, reason: `You must possess at least one of the following roles to apply: **${roleNames}**.` };
    }
  }

  // 6. Check existing submissions
  const submissions = await db.applicationSubmissions.list(guild.id, form.id);
  const userSubmissions = submissions.filter(s => s.applicantId === user.id);

  // Active pending or interviewing
  const activeSub = userSubmissions.find(s => s.status === 'pending' || s.status === 'interviewing');
  if (activeSub) {
    return {
      eligible: false,
      reason: `You already have an active application currently under review (Status: **${activeSub.status.toUpperCase()}**).`
    };
  }

  // Cooldown check on denied applications
  if (form.reapplyCooldownHours > 0) {
    const lastDenied = userSubmissions
      .filter(s => s.status === 'denied' && s.reviewedAt)
      .sort((a, b) => b.reviewedAt - a.reviewedAt)[0];

    if (lastDenied) {
      const hoursSince = (Date.now() - lastDenied.reviewedAt) / (1000 * 60 * 60);
      if (hoursSince < form.reapplyCooldownHours) {
        const remaining = (form.reapplyCooldownHours - hoursSince).toFixed(1);
        return {
          eligible: false,
          reason: `Your previous application was denied. You may re-apply in **${remaining} hours**.`
        };
      }
    }
  }

  return { eligible: true };
}

/**
 * Handle Start of Application (Button Click or /apply)
 */
async function startApplication(interaction, formId) {
  const member = interaction.member;
  const guild = interaction.guild;
  const user = interaction.user;

  const form = await db.applicationForms.get(formId);
  if (!form) {
    return interaction.reply({ content: '❌ Application form not found.', ephemeral: true });
  }

  // Eligibility check
  const check = await checkApplicationEligibility(member, form);
  if (!check.eligible) {
    return interaction.reply({ content: `🚫 ${check.reason}`, ephemeral: true });
  }

  const questions = form.questions || [];
  if (questions.length === 0) {
    return interaction.reply({ content: '❌ This application form has no questions configured.', ephemeral: true });
  }

  // Delivery method decision:
  // If <= 5 questions and none are 'choice' -> use Discord Modal
  const hasChoice = questions.some(q => q.type === 'choice');
  if (questions.length <= 5 && !hasChoice) {
    const modal = new ModalBuilder()
      .setCustomId(`app_modal:${form.id}`)
      .setTitle(form.name.substring(0, 45));

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const textInput = new TextInputBuilder()
        .setCustomId(`q_${i}`)
        .setLabel((q.prompt || `Question ${i + 1}`).substring(0, 45))
        .setStyle(q.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder('Enter your answer here...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    }

    return interaction.showModal(modal);
  }

  // Otherwise, use Interactive DM Step-by-Step Interview
  return startDmInterview(interaction, form);
}

/**
 * Handle Application Modal Submission
 */
async function handleApplicationModalSubmit(interaction) {
  const formId = interaction.customId.split(':')[1];
  const form = await db.applicationForms.get(formId);
  if (!form) {
    return interaction.reply({ content: '❌ Application form not found.', ephemeral: true });
  }

  const answers = [];
  const questions = form.questions || [];
  for (let i = 0; i < questions.length && i < 5; i++) {
    const answer = interaction.fields.getTextInputValue(`q_${i}`) || '';
    answers.push({
      prompt: questions[i].prompt || `Question ${i + 1}`,
      answer
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const submission = await submitApplication(interaction.guild, interaction.member, form, answers);
  return interaction.editReply({
    content: `✅ Your application for **${form.name}** has been submitted successfully! Staff will review it shortly.`
  });
}

/**
 * Interactive DM Interview Starter
 */
async function startDmInterview(interaction, form) {
  const user = interaction.user;
  const member = interaction.member;

  let dmChannel;
  try {
    dmChannel = await user.createDM();
    await dmChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📋 Application: ${form.name}`)
          .setColor('#5865F2')
          .setDescription(`Welcome ${user}!\nYou are now beginning your application for **${form.name}** in **${interaction.guild.name}**.\n\nPlease answer each question carefully. You have 5 minutes per question.\nClick **Cancel Application** at any time to abort.`)
          .setFooter({ text: `Total Questions: ${form.questions.length}` })
      ]
    });
  } catch (err) {
    return interaction.reply({
      content: '❌ Could not send you a Direct Message. Please ensure your Discord privacy settings allow Direct Messages from server members, then try again.',
      ephemeral: true
    });
  }

  await interaction.reply({
    content: '📬 I have sent you a Direct Message to complete your application step-by-step!',
    ephemeral: true
  });

  // Register active interview session
  const session = {
    guildId: interaction.guild.id,
    form,
    member,
    user,
    currentQuestionIndex: 0,
    answers: [],
    dmChannel,
    timeoutHandle: null
  };

  activeInterviews.set(user.id, session);
  return sendNextInterviewQuestion(session);
}

/**
 * Send the next question in the DM interview
 */
async function sendNextInterviewQuestion(session) {
  const { form, currentQuestionIndex, dmChannel, user } = session;

  if (currentQuestionIndex >= form.questions.length) {
    // Completed all questions!
    activeInterviews.delete(user.id);
    clearTimeout(session.timeoutHandle);

    const guild = session.member.guild;
    await submitApplication(guild, session.member, form, session.answers);

    return dmChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎉 Application Submitted!')
          .setColor('#57F287')
          .setDescription(`Thank you for completing the application for **${form.name}**!\nOur staff team has received your submission and will review it soon.`)
      ]
    });
  }

  const q = form.questions[currentQuestionIndex];
  const qNum = currentQuestionIndex + 1;
  const total = form.questions.length;

  const embed = new EmbedBuilder()
    .setTitle(`Question ${qNum} of ${total}`)
    .setDescription(`**${q.prompt}**`)
    .setColor('#38BDF8')
    .setFooter({ text: q.type === 'choice' ? 'Select an option below' : 'Type your answer in this DM chat' });

  const components = [];

  if (q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`app_dm_choice:${currentQuestionIndex}`)
      .setPlaceholder('Choose an option...')
      .addOptions(
        q.options.slice(0, 25).map(opt => ({
          label: String(opt).substring(0, 100),
          value: String(opt).substring(0, 100)
        }))
      );
    components.push(new ActionRowBuilder().addComponents(select));
  }

  const cancelBtn = new ButtonBuilder()
    .setCustomId('app_dm_cancel')
    .setLabel('Cancel Application')
    .setStyle(ButtonStyle.Danger);
  components.push(new ActionRowBuilder().addComponents(cancelBtn));

  await dmChannel.send({ embeds: [embed], components });

  // 5 minute timeout per question
  clearTimeout(session.timeoutHandle);
  session.timeoutHandle = setTimeout(async () => {
    activeInterviews.delete(user.id);
    await dmChannel.send({ content: '⏱️ Application timed out due to inactivity. You may restart whenever you are ready.' }).catch(() => {});
  }, 5 * 60 * 1000);
}

/**
 * Handle incoming DM text messages for active interviews
 */
async function handleDmInterviewMessage(message) {
  if (message.author.bot || !activeInterviews.has(message.author.id)) return false;

  const session = activeInterviews.get(message.author.id);
  const q = session.form.questions[session.currentQuestionIndex];

  // If currently waiting for a choice menu selection, ignore raw text
  if (q.type === 'choice') return false;

  const answer = message.content.trim();
  if (!answer) return false;

  session.answers.push({
    prompt: q.prompt,
    answer
  });

  session.currentQuestionIndex++;
  await sendNextInterviewQuestion(session);
  return true;
}

/**
 * Handle DM Interaction Components (Choice select or Cancel)
 */
async function handleDmInterviewInteraction(interaction) {
  if (!activeInterviews.has(interaction.user.id)) {
    return interaction.reply({ content: '❌ No active interview session found.', ephemeral: true });
  }

  const session = activeInterviews.get(interaction.user.id);

  if (interaction.customId === 'app_dm_cancel') {
    clearTimeout(session.timeoutHandle);
    activeInterviews.delete(interaction.user.id);
    return interaction.update({
      content: '❌ Application cancelled. No responses were submitted.',
      embeds: [],
      components: []
    });
  }

  if (interaction.customId.startsWith('app_dm_choice:')) {
    const selected = interaction.values[0];
    const q = session.form.questions[session.currentQuestionIndex];

    session.answers.push({
      prompt: q.prompt,
      answer: selected
    });

    await interaction.update({
      content: `✅ Selected: **${selected}**`,
      components: []
    });

    session.currentQuestionIndex++;
    return sendNextInterviewQuestion(session);
  }
}

/**
 * Submit Completed Application to Database & Staff Review Channel
 */
async function submitApplication(guild, member, form, answers) {
  const submissionId = `sub_${Date.now()}`;
  const user = member.user;
  const botId = guild.client.botId || 'primary';

  const submission = await db.applicationSubmissions.create({
    submissionId,
    botId,
    guildId: guild.id,
    formId: form.id,
    applicantId: user.id,
    applicantTag: user.tag,
    applicantAvatar: user.displayAvatarURL({ extension: 'png', size: 128 }),
    answersJson: answers,
    status: 'pending',
    upvotes: [],
    downvotes: [],
    createdAt: Date.now()
  });

  // Post in Staff Review Channel
  if (form.reviewChannelId) {
    const reviewChan = guild.channels.cache.get(form.reviewChannelId);
    if (reviewChan && reviewChan.isTextBased()) {
      const accountCreated = Math.floor(user.createdTimestamp / 1000);
      const joinedServer = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

      const reviewEmbed = new EmbedBuilder()
        .setTitle(`📋 New Application: ${form.name}`)
        .setColor('#5865F2')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(
          `**Applicant:** ${user} (\`${user.tag}\`)\n` +
          `**User ID:** \`${user.id}\`\n` +
          `**Account Created:** <t:${accountCreated}:R>\n` +
          (joinedServer ? `**Joined Server:** <t:${joinedServer}:R>\n` : '') +
          `**Position:** ${form.name}`
        )
        .addFields(
          answers.map((a, idx) => ({
            name: `${idx + 1}. ${a.prompt}`,
            value: a.answer ? `> ${a.answer.substring(0, 1000)}` : '*(No answer)*',
            inline: false
          }))
        )
        .addFields(
          { name: '📊 Status', value: '🟡 **Pending Review**', inline: true },
          { name: '🗳️ Tally', value: '👍 0 Upvotes • 👎 0 Downvotes', inline: true }
        )
        .setFooter({ text: `Submission ID: ${submissionId}` })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`app_vote:${submissionId}:up`).setLabel('0').setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`app_vote:${submissionId}:down`).setLabel('0').setEmoji('👎').setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`app_accept_prompt:${submissionId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`app_deny_prompt:${submissionId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`app_interview:${submissionId}`).setLabel('Interview Thread').setStyle(ButtonStyle.Primary)
      );

      const reviewMsg = await reviewChan.send({ embeds: [reviewEmbed], components: [row1, row2] });
      await db.applicationSubmissions.update(submissionId, { reviewMessageId: reviewMsg.id });
    }
  }

  return submission;
}

/**
 * Handle Staff Review Queue Action Buttons
 */
async function handleStaffReviewAction(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const submissionId = parts[1];
  const guild = interaction.guild;
  const reviewer = interaction.user;

  const submission = await db.applicationSubmissions.get(submissionId);
  if (!submission) {
    return interaction.reply({ content: '❌ Application submission not found.', ephemeral: true });
  }

  const form = await db.applicationForms.get(submission.formId);

  // 1. UPVOTE / DOWNVOTE
  if (action === 'app_vote') {
    const voteType = parts[2];
    const upvotes = submission.upvotes || [];
    const downvotes = submission.downvotes || [];

    if (voteType === 'up') {
      const upIndex = upvotes.indexOf(reviewer.id);
      if (upIndex >= 0) {
        upvotes.splice(upIndex, 1); // remove upvote
      } else {
        upvotes.push(reviewer.id);
        const downIndex = downvotes.indexOf(reviewer.id);
        if (downIndex >= 0) downvotes.splice(downIndex, 1);
      }
    } else {
      const downIndex = downvotes.indexOf(reviewer.id);
      if (downIndex >= 0) {
        downvotes.splice(downIndex, 1); // remove downvote
      } else {
        downvotes.push(reviewer.id);
        const upIndex = upvotes.indexOf(reviewer.id);
        if (upIndex >= 0) upvotes.splice(upIndex, 1);
      }
    }

    await db.applicationSubmissions.update(submissionId, { upvotes, downvotes });

    // Update message buttons and tally field
    const msg = interaction.message;
    if (msg && msg.embeds.length > 0) {
      const oldEmbed = msg.embeds[0];
      const fields = oldEmbed.fields.map(f => {
        if (f.name.includes('Tally') || f.name.includes('Votes')) {
          return { name: '🗳️ Tally', value: `👍 ${upvotes.length} Upvotes • 👎 ${downvotes.length} Downvotes`, inline: true };
        }
        return f;
      });

      const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(fields);
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`app_vote:${submissionId}:up`).setLabel(String(upvotes.length)).setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`app_vote:${submissionId}:down`).setLabel(String(downvotes.length)).setEmoji('👎').setStyle(ButtonStyle.Danger)
      );

      await interaction.update({ embeds: [updatedEmbed], components: [row1, msg.components[1]] });
    } else {
      await interaction.reply({ content: '✅ Vote recorded.', ephemeral: true });
    }
    return;
  }

  // 2. ACCEPT PROMPT MODAL
  if (action === 'app_accept_prompt') {
    const modal = new ModalBuilder()
      .setCustomId(`app_accept_modal:${submissionId}`)
      .setTitle('Accept Staff Application')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('note')
            .setLabel('Acceptance Note (sent to applicant)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Welcome to the staff team! Next steps...')
            .setRequired(false)
        )
      );
    return interaction.showModal(modal);
  }

  // 3. DENY PROMPT MODAL
  if (action === 'app_deny_prompt') {
    const modal = new ModalBuilder()
      .setCustomId(`app_deny_modal:${submissionId}`)
      .setTitle('Deny Staff Application')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for Rejection')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Unfortunately we cannot proceed at this time because...')
            .setRequired(false)
        )
      );
    return interaction.showModal(modal);
  }

  // 4. CREATE INTERVIEW THREAD
  if (action === 'app_interview') {
    if (submission.interviewThreadId) {
      const existingThread = guild.channels.cache.get(submission.interviewThreadId);
      if (existingThread) {
        return interaction.reply({ content: `ℹ️ Interview thread already active: ${existingThread}`, ephemeral: true });
      }
    }

    try {
      const thread = await interaction.channel.threads.create({
        name: `interview-${submission.applicantTag || 'applicant'}`,
        autoArchiveDuration: 1440,
        type: ChannelType.PrivateThread,
        reason: `Staff interview for applicant ${submission.applicantTag}`
      });

      await thread.members.add(submission.applicantId).catch(() => {});
      await thread.members.add(reviewer.id).catch(() => {});

      await db.applicationSubmissions.update(submissionId, {
        status: 'interviewing',
        interviewThreadId: thread.id
      });

      await thread.send({
        content: `<@${submission.applicantId}> ${reviewer}`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎙️ Staff Interview: ${form?.name || 'Position'}`)
            .setColor('#38BDF8')
            .setDescription(`Welcome <@${submission.applicantId}> to your private staff interview!\nReviewer ${reviewer} has initiated this thread to discuss your application.`)
            .setTimestamp()
        ]
      });

      return interaction.reply({ content: `✅ Private interview thread created: ${thread}`, ephemeral: true });
    } catch (err) {
      logger.error('Failed to create interview thread', err, 'APPLICATIONS');
      return interaction.reply({ content: `❌ Failed to create interview thread: ${err.message}`, ephemeral: true });
    }
  }
}

/**
 * Handle Accept & Deny Modal Submissions
 */
async function handleStaffDecisionModal(interaction) {
  const [modalType, submissionId] = interaction.customId.split(':');
  const guild = interaction.guild;
  const reviewer = interaction.user;

  const submission = await db.applicationSubmissions.get(submissionId);
  if (!submission) {
    return interaction.reply({ content: '❌ Submission record not found.', ephemeral: true });
  }

  const form = await db.applicationForms.get(submission.formId);
  const applicantMember = await guild.members.fetch(submission.applicantId).catch(() => null);

  if (modalType === 'app_accept_modal') {
    const note = interaction.fields.getTextInputValue('note') || 'Congratulations on joining the team!';

    // Grant accept roles & strip remove roles
    if (applicantMember && form) {
      if (Array.isArray(form.acceptRoleIds)) {
        for (const roleId of form.acceptRoleIds) {
          if (guild.roles.cache.has(roleId)) await applicantMember.roles.add(roleId).catch(() => {});
        }
      }
      if (Array.isArray(form.removeRoleIds)) {
        for (const roleId of form.removeRoleIds) {
          if (guild.roles.cache.has(roleId)) await applicantMember.roles.remove(roleId).catch(() => {});
        }
      }
    }

    await db.applicationSubmissions.update(submissionId, {
      status: 'accepted',
      reviewedBy: reviewer.id,
      reviewedByTag: reviewer.tag,
      reviewNote: note,
      reviewedAt: Date.now()
    });

    // Send DM to applicant
    if (applicantMember) {
      try {
        const dmCfg = form?.acceptDmEmbed || {};
        const dmEmbed = new EmbedBuilder()
          .setTitle(dmCfg.title || '🎉 Application Accepted!')
          .setColor(dmCfg.color || '#57F287')
          .setDescription(`${dmCfg.description || 'Your staff application has been accepted!'}\n\n**Note from Staff:**\n> ${note}`)
          .setTimestamp();
        await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch {}
    }

    // Update review message
    const msg = interaction.message;
    if (msg && msg.embeds.length > 0) {
      const oldEmbed = msg.embeds[0];
      const fields = oldEmbed.fields.map(f => {
        if (f.name.includes('Status')) return { name: '📊 Status', value: '🟢 **Accepted**', inline: true };
        return f;
      });
      fields.push({ name: 'Decision Note', value: note, inline: false });

      const updatedEmbed = EmbedBuilder.from(oldEmbed).setColor('#57F287').setFields(fields);
      await interaction.update({ embeds: [updatedEmbed], components: [] });
    } else {
      await interaction.reply({ content: `✅ Application accepted by ${reviewer}.`, ephemeral: true });
    }
  }

  if (modalType === 'app_deny_modal') {
    const reason = interaction.fields.getTextInputValue('reason') || 'Application rejected.';

    await db.applicationSubmissions.update(submissionId, {
      status: 'denied',
      reviewedBy: reviewer.id,
      reviewedByTag: reviewer.tag,
      reviewNote: reason,
      reviewedAt: Date.now()
    });

    // Send DM to applicant
    if (applicantMember) {
      try {
        const dmCfg = form?.denyDmEmbed || {};
        const dmEmbed = new EmbedBuilder()
          .setTitle(dmCfg.title || 'Application Update')
          .setColor(dmCfg.color || '#ED4245')
          .setDescription(`${dmCfg.description || 'Thank you for applying. Unfortunately your application was not accepted at this time.'}\n\n**Reason:**\n> ${reason}`)
          .setTimestamp();
        await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch {}
    }

    // Update review message
    const msg = interaction.message;
    if (msg && msg.embeds.length > 0) {
      const oldEmbed = msg.embeds[0];
      const fields = oldEmbed.fields.map(f => {
        if (f.name.includes('Status')) return { name: '📊 Status', value: '🔴 **Denied**', inline: true };
        return f;
      });
      fields.push({ name: 'Rejection Reason', value: reason, inline: false });

      const updatedEmbed = EmbedBuilder.from(oldEmbed).setColor('#ED4245').setFields(fields);
      await interaction.update({ embeds: [updatedEmbed], components: [] });
    } else {
      await interaction.reply({ content: `❌ Application denied by ${reviewer}.`, ephemeral: true });
    }
  }
}

module.exports = {
  startApplication,
  handleApplicationModalSubmit,
  handleDmInterviewMessage,
  handleDmInterviewInteraction,
  handleStaffReviewAction,
  handleStaffDecisionModal,
  submitApplication
};
