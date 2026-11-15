/**
 * Economy Command: /shop-add (Admin)
 */

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop-add')
    .setDescription('Add a purchasable item or role to the server shop')
    .addStringOption(opt => opt.setName('name').setDescription('Item title').setRequired(true))
    .addIntegerOption(opt => opt.setName('price').setDescription('Cost in coins').setMinValue(1).setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Role awarded when purchased'))
    .addStringOption(opt => opt.setName('description').setDescription('Item description'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const price = interaction.options.getInteger('price');
    const role = interaction.options.getRole('role');
    const description = interaction.options.getString('description') || '';

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);

    const newItem = await db.shop.add({
      id,
      guildId: interaction.guild.id,
      name,
      price,
      roleId: role ? role.id : null,
      description
    });

    const settings = await db.guilds.get(interaction.guild.id);
    const symbol = settings.economy?.currencySymbol || '🪙';

    const embed = new EmbedBuilder()
      .setTitle('✅ Item Added to Shop')
      .setColor('#57F287')
      .addFields(
        { name: 'Item Name', value: name, inline: true },
        { name: 'ID', value: `\`${newItem.id}\``, inline: true },
        { name: 'Price', value: `${symbol} ${price.toLocaleString()}`, inline: true },
        { name: 'Role Reward', value: role ? `${role}` : '*None*', inline: true },
        { name: 'Description', value: description || '*None*', inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
