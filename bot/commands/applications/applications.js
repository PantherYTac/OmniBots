/**
 * Application Command: /applications [status]
 * List and review pending staff submissions
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('applications')
    .setDescription('View and review recent staff applications')
    .addStringOption(opt =>
      opt.setName('status')
        .setDescription('Filter by status')
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Interviewing', value: 'interviewing' },
          { name: 'Accepted', value: 'accepted' },
          { name: 'Denied', value: 'denied' }
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  aliases: ['apps', 'staff-apps'],
  module: 'applications',

  async execute(ctx) {
    if (!ctx.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return ctx.reply({ content: '🚫 You need `Manage Server` permissions to view staff applications.', ephemeral: true });
    }

    const status = ctx.options.getString('status') || null;
    const submissions = await db.applicationSubmissions.list(ctx.guild.id, null, status);

    if (submissions.length === 0) {
      return ctx.reply({
        content: `ℹ️ No ${status ? `**${status}** ` : ''}applications found for this server.`,
        ephemeral: true
      });
    }

    const statusIcons = {
      pending: '🟡',
      interviewing: '🔵',
      accepted: '🟢',
      denied: '🔴'
    };

    const desc = submissions.slice(0, 10).map((sub, idx) => {
      const icon = statusIcons[sub.status] || '⚪';
      const date = new Date(sub.createdAt).toLocaleDateString();
      const up = (sub.upvotes || []).length;
      const down = (sub.downvotes || []).length;
      return `**${idx + 1}. [${sub.submissionId}]** <@${sub.applicantId}> (\`${sub.applicantTag}\`)\n` +
        `> Status: ${icon} **${sub.status.toUpperCase()}** • Votes: 👍 ${up} / 👎 ${down} • Date: ${date}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`📋 Server Application Submissions ${status ? `(${status.toUpperCase()})` : ''}`)
      .setColor('#5865F2')
      .setDescription(desc)
      .setFooter({ text: `Showing ${Math.min(10, submissions.length)} of ${submissions.length} total • Use Web Dashboard for full reviews` })
      .setTimestamp();

    return ctx.reply({ embeds: [embed] });
  }
};
