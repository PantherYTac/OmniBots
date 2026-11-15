/**
 * Slash Command: /invites [user]
 * Displays detailed invite stats: Regular, Bonus, Leaves, Fake, and Net Total
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check invite statistics for yourself or another server member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member whose invites you want to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildSettings = await db.guilds.get(interaction.guild.id);

    const subtractLeaves = guildSettings.inviteTracking?.subtractLeaves !== false;
    const invData = await db.invites.get(interaction.guild.id, targetUser.id);

    const regular = invData.regular || 0;
    const bonus = invData.bonus || 0;
    const leaves = invData.leaves || 0;
    const fake = invData.fake || 0;
    const total = invData.total || (regular + fake);
    const net = (regular + bonus) - (subtractLeaves ? leaves : 0);

    const embed = new EmbedBuilder()
      .setTitle(`📨 Invite Statistics • ${targetUser.username}`)
      .setColor('#5865F2')
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        targetUser.id === interaction.user.id
          ? `Here is your current invite performance in **${interaction.guild.name}**:`
          : `Here is the current invite performance for <@${targetUser.id}> in **${interaction.guild.name}**:`
      )
      .addFields(
        { name: '✨ Net Invites', value: `\`${net}\``, inline: true },
        { name: '✅ Regular', value: `\`${regular}\``, inline: true },
        { name: '🎁 Bonus', value: `\`${bonus}\``, inline: true },
        { name: '🚪 Leaves', value: `\`${leaves}\``, inline: true },
        { name: '⚠️ Fake (< 7d)', value: `\`${fake}\``, inline: true },
        { name: '📊 Total Joins', value: `\`${total}\``, inline: true }
      )
      .setFooter({
        text: subtractLeaves
          ? 'Formula: Regular + Bonus - Leaves'
          : 'Formula: Regular + Bonus',
        iconURL: interaction.guild.iconURL()
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
