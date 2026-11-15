/**
 * Economy Command: /rob
 * Attempt to pickpocket another member with success chance and penalty risk
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../../shared');

const ROB_COOLDOWN = 30 * 60 * 1000; // 30 minutes

module.exports = {
  module: 'economy',
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob wallet coins from another member')
    .addUserOption(opt => opt.setName('target').setDescription('The member to rob').setRequired(true)),

  async execute(ctx) {
    const targetUser = ctx.options.getUser('target');

    if (!targetUser) {
      return ctx.reply({ content: '❌ Please specify a valid member to rob.', ephemeral: true });
    }

    if (targetUser.id === ctx.user.id) {
      return ctx.reply({ content: '❌ You cannot rob yourself!', ephemeral: true });
    }

    if (targetUser.bot) {
      return ctx.reply({ content: '❌ You cannot rob a bot!', ephemeral: true });
    }

    const robberEco = await db.economy.get(ctx.guild.id, ctx.user.id);
    const victimEco = await db.economy.get(ctx.guild.id, targetUser.id);

    const now = Date.now();
    const lastRob = robberEco.lastRob || 0;
    if (now - lastRob < ROB_COOLDOWN) {
      const remainingSec = Math.ceil((ROB_COOLDOWN - (now - lastRob)) / 1000);
      const min = Math.floor(remainingSec / 60);
      const sec = remainingSec % 60;
      return ctx.reply({ content: `👮 You are laying low from the police! Wait **${min}m ${sec}s** before robbing again.`, ephemeral: true });
    }

    if ((robberEco.wallet || 0) < 100) {
      return ctx.reply({ content: '❌ You need at least **100 coins** in your wallet to cover bail if you get caught!', ephemeral: true });
    }

    if ((victimEco.wallet || 0) < 50) {
      return ctx.reply({ content: `❌ **${targetUser.tag}** only has ${(victimEco.wallet || 0)} coins in their wallet. Not worth the risk!`, ephemeral: true });
    }

    robberEco.lastRob = now;

    // 45% Success Chance
    const success = Math.random() < 0.45;

    if (success) {
      // Steal between 20% and 50% of victim's wallet
      const percent = Math.random() * 0.3 + 0.2;
      const stolenAmount = Math.max(10, Math.floor(victimEco.wallet * percent));

      victimEco.wallet -= stolenAmount;
      robberEco.wallet += stolenAmount;

      await db.economy.save(ctx.guild.id, targetUser.id, victimEco);
      await db.economy.save(ctx.guild.id, ctx.user.id, robberEco);

      const embed = new EmbedBuilder()
        .setTitle('🥷 Heist Successful!')
        .setColor('#57F287')
        .setDescription(`You successfully pickpocketed **${stolenAmount.toLocaleString()} coins** from **${targetUser.tag}**!`)
        .addFields(
          { name: 'Your New Wallet', value: `🪙 ${robberEco.wallet.toLocaleString()}`, inline: true },
          { name: 'Victim Remaining', value: `🪙 ${victimEco.wallet.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    } else {
      // Failed: Pay fine between 100 and 300 coins
      const fine = Math.min(robberEco.wallet, Math.floor(Math.random() * 200) + 100);
      robberEco.wallet -= fine;
      await db.economy.save(ctx.guild.id, ctx.user.id, robberEco);

      const embed = new EmbedBuilder()
        .setTitle('🚨 Busted by the Police!')
        .setColor('#ED4245')
        .setDescription(`You were caught trying to rob **${targetUser.tag}** and were fined **${fine.toLocaleString()} coins**!`)
        .addFields({ name: 'Remaining Wallet', value: `🪙 ${robberEco.wallet.toLocaleString()}` })
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    }
  }
};