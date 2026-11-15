/**
 * Economy Command: /shop and /buy
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View server store items or buy an item')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Browse all purchasable items and roles in the server store')
    )
    .addSubcommand(sub =>
      sub
        .setName('buy')
        .setDescription('Purchase an item from the server shop')
        .addStringOption(opt => opt.setName('item_id').setDescription('ID of the item to buy').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const items = await db.shop.list(interaction.guild.id);
    const settings = await db.guilds.get(interaction.guild.id);
    const symbol = settings.economy?.currencySymbol || '🪙';

    if (sub === 'view') {
      if (items.length === 0) {
        return interaction.reply({
          content: '🛒 The server shop is currently empty. Administrators can add items with `/shop-add` or via the Web Dashboard!',
          ephemeral: true
        });
      }

      const desc = items.map((item, idx) => {
        const roleText = item.roleId ? `• Awards: <@&${item.roleId}>` : '';
        return `**${idx + 1}. ${item.name}** (\`ID: ${item.id}\`)\nPrice: ${symbol} **${item.price.toLocaleString()}** ${roleText}\n*${item.description || 'No description'}*`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`🛒 ${interaction.guild.name} Server Shop`)
        .setColor('#5865F2')
        .setDescription(desc)
        .setFooter({ text: 'Use /shop buy item_id to purchase' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'buy') {
      const itemId = interaction.options.getString('item_id').trim();
      const item = items.find(i => i.id.toLowerCase() === itemId.toLowerCase());

      if (!item) {
        return interaction.reply({ content: `❌ Shop item with ID \`${itemId}\` not found. Use \`/shop view\` to see available item IDs.`, ephemeral: true });
      }

      const eco = await db.economy.get(interaction.guild.id, interaction.user.id);
      if ((eco.wallet || 0) < item.price) {
        return interaction.reply({ content: `❌ You don't have enough coins in your wallet! Needed: ${symbol} ${item.price.toLocaleString()}, Have: ${symbol} ${(eco.wallet || 0).toLocaleString()}`, ephemeral: true });
      }

      // Deduct coins
      eco.wallet -= item.price;
      await db.economy.save(interaction.guild.id, interaction.user.id, eco);

      let roleMsg = '';
      if (item.roleId) {
        const role = interaction.guild.roles.cache.get(item.roleId);
        if (role) {
          await interaction.member.roles.add(role).catch(() => {});
          roleMsg = ` and you were awarded the **${role.name}** role!`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🎉 Purchase Completed!')
        .setColor('#57F287')
        .setDescription(`You successfully purchased **${item.name}** for ${symbol} **${item.price.toLocaleString()}**${roleMsg}`)
        .addFields({ name: 'Remaining Wallet Balance', value: `${symbol} ${eco.wallet.toLocaleString()}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
