/**
 * Moderation Commands: /warn, /warnings, /clearwarnings with Auto-Escalation
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');
const { parseDuration } = require('../../../shared/utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue, view, or clear infractions and warnings')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Issue a formal warning to a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View infractions and warnings for a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to check').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to clear').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');

    if (sub === 'add') {
      const reason = interaction.options.getString('reason');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot warn yourself.', ephemeral: true });
      }

      await db.infractions.add({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'warn',
        reason
      });

      const totalWarns = await db.infractions.count(interaction.guild.id, targetUser.id, 'warn');

      // Check Auto-Escalation Rules
      const guildSettings = await db.guilds.get(interaction.guild.id);
      const automod = guildSettings.automod || {};
      const escalations = (automod.escalation || []).sort((a, b) => b.warns - a.warns);

      let escalatedRule = null;
      for (const rule of escalations) {
        if (totalWarns >= rule.warns) {
          escalatedRule = rule;
          break;
        }
      }

      let escalationText = '';
      if (escalatedRule && member && member.moderatable) {
        if (escalatedRule.action === 'timeout') {
          const ms = parseDuration(escalatedRule.duration || '1h');
          await member.timeout(ms, `Auto-Escalation reached (${totalWarns} warnings)`);
          escalationText = `\n🔒 **Auto-Escalation:** Timed out for ${escalatedRule.duration || '1h'}.`;
        } else if (escalatedRule.action === 'kick') {
          await member.kick(`Auto-Escalation reached (${totalWarns} warnings)`);
          escalationText = `\n🚪 **Auto-Escalation:** Kicked from server.`;
        } else if (escalatedRule.action === 'ban') {
          await member.ban({ reason: `Auto-Escalation reached (${totalWarns} warnings)` });
          escalationText = `\n⛔ **Auto-Escalation:** Banned from server.`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Warning Issued')
        .setColor('#FEE75C')
        .addFields(
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Total Warnings', value: `${totalWarns}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setDescription(escalationText || null)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const infractions = await db.infractions.list(interaction.guild.id, targetUser.id);

      if (infractions.length === 0) {
        return interaction.reply({ content: `✅ **${targetUser.tag}** has a completely clean record with zero infractions.`, ephemeral: true });
      }

      const listDesc = infractions.slice(0, 10).map((inf, idx) => {
        const date = new Date(inf.timestamp).toLocaleDateString();
        return `**${idx + 1}. [${inf.type.toUpperCase()}]** — ${inf.reason}\n*By <@${inf.moderatorId}> on ${date}*`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`📋 Infraction History: ${targetUser.tag}`)
        .setColor('#5865F2')
        .setDescription(listDesc)
        .setFooter({ text: `Showing ${Math.min(10, infractions.length)} of ${infractions.length} total infractions` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'clear') {
      await db.infractions.clear(interaction.guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('🧹 Warnings Cleared')
        .setColor('#57F287')
        .setDescription(`All warnings and infraction history for **${targetUser.tag}** have been cleared by ${interaction.user}.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
