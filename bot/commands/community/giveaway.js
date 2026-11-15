/**
 * Community Command: /giveaway (Start and Reroll)
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../../shared');
const { parseDuration, formatDuration } = require('../../../shared/utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Host giveaways or reroll winners')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a new interactive giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20))
        .addRoleOption(opt => opt.setName('role_requirement').setDescription('Required role to enter'))
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Pick new winner(s) for an ended giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('ID of the giveaway message').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winnersCount = interaction.options.getInteger('winners') || 1;
      const roleReq = interaction.options.getRole('role_requirement');

      const ms = parseDuration(durationStr);
      if (!ms || ms < 5000) {
        return interaction.reply({ content: '❌ Invalid duration. Please provide a duration like `10m`, `1h`, `1d`.', ephemeral: true });
      }

      const endsAt = Date.now() + ms;

      const embed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY: ${prize}`)
        .setColor('#5865F2')
        .setDescription(`Click the **Join Giveaway (🎉)** button below to enter!\n\n` +
          `• **Winners:** ${winnersCount}\n` +
          `• **Ends:** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)\n` +
          `• **Hosted By:** ${interaction.user}\n` +
          (roleReq ? `• **Requirement:** Must have <@&${roleReq.id}>\n` : '')
        )
        .setFooter({ text: 'Entries: 0' })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_placeholder')
          .setLabel('Join Giveaway')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      // Update button customId with actual message ID
      const activeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join:${msg.id}`)
          .setLabel('Join Giveaway')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Primary)
      );
      await msg.edit({ components: [activeRow] });

      await db.giveaways.create({
        messageId: msg.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        prize,
        winnersCount,
        roleRequired: roleReq ? roleReq.id : null,
        hostId: interaction.user.id,
        endsAt,
        entries: [],
        ended: false
      });

      // Schedule giveaway conclusion timer
      setTimeout(async () => {
        endGiveaway(interaction.client, msg.id);
      }, ms);

      return interaction.reply({ content: '✅ Giveaway successfully started!', ephemeral: true });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id').trim();
      const giveaway = await db.giveaways.get(messageId);

      if (!giveaway) {
        return interaction.reply({ content: `❌ Giveaway with message ID \`${messageId}\` not found in database.`, ephemeral: true });
      }

      const winners = pickRandomWinners(giveaway.entries || [], giveaway.winnersCount || 1);
      if (winners.length === 0) {
        return interaction.reply({ content: '⚠️ Not enough entries to pick a new winner.', ephemeral: true });
      }

      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      return interaction.reply({
        content: `🎉 **Giveaway Reroll Winner(s):** Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`
      });
    }
  }
};

async function endGiveaway(client, messageId) {
  const giveaway = await db.giveaways.get(messageId);
  if (!giveaway || giveaway.ended) return;

  const channel = client.channels.cache.get(giveaway.channelId);
  if (!channel) return;

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return;

  const entries = giveaway.entries || [];
  const winners = pickRandomWinners(entries, giveaway.winnersCount || 1);

  await db.giveaways.update(messageId, { ended: true, winners });

  const winnerMentions = winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entries';

  const endedEmbed = EmbedBuilder.from(msg.embeds[0])
    .setColor(winners.length > 0 ? '#57F287' : '#ED4245')
    .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
    .setDescription(`**Winner(s):** ${winnerMentions}\n**Hosted By:** <@${giveaway.hostId}>\n**Total Entries:** ${entries.length}`)
    .setFooter({ text: 'Ended' })
    .setTimestamp();

  await msg.edit({ embeds: [endedEmbed], components: [] });

  if (winners.length > 0) {
    channel.send({ content: `🎉 Congratulations ${winnerMentions}! You won the **${giveaway.prize}**!` }).catch(() => {});
  }
}

function pickRandomWinners(entries, count) {
  if (!entries || entries.length === 0) return [];
  const pool = [...entries];
  const winners = [];
  const numToPick = Math.min(count, pool.length);

  for (let i = 0; i < numToPick; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return winners;
}
