/**
 * OmniBots - Unified Command Router
 * Dispatches both Slash (/) and Prefix commands with unified permission,
 * cooldown, alias, and whitelist/blacklist channel/role checks.
 */

const CommandContext = require('../structures/CommandContext');
const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

// Cooldown tracker: Map<`${guildId}_${userId}_${commandName}`, timestamp>
const cooldowns = new Map();

/**
 * Resolve command from registry by name or alias
 */
function resolveCommand(client, searchName, guildCommandsConfig = null) {
  const clean = (searchName || '').toLowerCase().trim();
  if (!clean) return null;

  // Direct match
  if (client.commands.has(clean)) {
    return client.commands.get(clean);
  }

  // Check custom per-guild aliases
  if (guildCommandsConfig && guildCommandsConfig.commands) {
    for (const [cmdName, cfg] of Object.entries(guildCommandsConfig.commands)) {
      if (cfg.aliases && Array.isArray(cfg.aliases)) {
        if (cfg.aliases.map(a => a.toLowerCase().trim()).includes(clean)) {
          return client.commands.get(cmdName);
        }
      }
    }
  }

  // Check default command aliases
  for (const cmd of client.commands.values()) {
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      if (cmd.aliases.map(a => a.toLowerCase().trim()).includes(clean)) {
        return cmd;
      }
    }
  }

  return null;
}

/**
 * Check if command execution is allowed based on permissions, whitelist/blacklist & cooldowns
 */
async function validateExecution(ctx, command, guildConfig) {
  const guild = ctx.guild;
  const member = ctx.member;
  const channel = ctx.channel;

  if (!guild || !member) return { allowed: true };

  // Administrators bypass all channel/role restrictions
  const isAdmin = member.permissions.has('Administrator') || member.id === guild.ownerId;

  const cmdConfig = guildConfig?.commands?.[command.data.name] || {};

  // 1. Module & Command Enablement Check
  const moduleName = command.module || 'general';
  if (guildConfig?.modules && guildConfig.modules[moduleName] === false) {
    return { allowed: false, reason: `The **${moduleName}** module is disabled on this server.` };
  }
  if (cmdConfig.enabled === false) {
    return { allowed: false, reason: `The \`${command.data.name}\` command is disabled on this server.` };
  }

  if (isAdmin) return { allowed: true };

  // 2. Channel Whitelist / Blacklist
  if (cmdConfig.blockedChannels && cmdConfig.blockedChannels.includes(channel.id)) {
    return { allowed: false, reason: `This command cannot be used in ${channel}.` };
  }
  if (cmdConfig.allowedChannels && cmdConfig.allowedChannels.length > 0) {
    if (!cmdConfig.allowedChannels.includes(channel.id)) {
      const allowedMentions = cmdConfig.allowedChannels.map(id => `<#${id}>`).join(', ');
      return { allowed: false, reason: `This command can only be used in: ${allowedMentions}` };
    }
  }

  // 3. Role Whitelist / Blacklist
  const memberRoleIds = Array.from(member.roles.cache.keys());
  if (cmdConfig.blockedRoles && cmdConfig.blockedRoles.some(r => memberRoleIds.includes(r))) {
    return { allowed: false, reason: `You have a role that is blocked from using this command.` };
  }
  if (cmdConfig.allowedRoles && cmdConfig.allowedRoles.length > 0) {
    if (!cmdConfig.allowedRoles.some(r => memberRoleIds.includes(r))) {
      return { allowed: false, reason: `You do not have the required role to execute this command.` };
    }
  }

  // 4. Cooldown Check
  const cooldownSecs = cmdConfig.cooldown ?? command.cooldown ?? 3;
  if (cooldownSecs > 0) {
    const key = `${guild.id}_${ctx.user.id}_${command.data.name}`;
    const now = Date.now();
    const lastUsed = cooldowns.get(key) || 0;
    const diff = (now - lastUsed) / 1000;

    if (diff < cooldownSecs) {
      const remaining = (cooldownSecs - diff).toFixed(1);
      return { allowed: false, reason: `Please wait **${remaining}s** before using \`${command.data.name}\` again.` };
    }
    cooldowns.set(key, now);
  }

  return { allowed: true };
}

/**
 * Handle incoming Slash Command Interaction
 */
async function handleSlashCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: '❌ Unknown application command.', ephemeral: true });
  }

  const guildConfig = interaction.guild ? await db.commandsConfig.get(interaction.guild.id) : null;
  const ctx = new CommandContext({
    interaction,
    commandName: interaction.commandName
  });

  // Permission & Cooldown Validation
  const validation = await validateExecution(ctx, command, guildConfig);
  if (!validation.allowed) {
    return ctx.reply({ content: `🚫 ${validation.reason}`, ephemeral: true });
  }

  try {
    await command.execute(ctx);
  } catch (err) {
    logger.error(`Error executing slash command /${interaction.commandName}`, err, 'COMMAND_ROUTER');
    const msg = '❌ An unexpected error occurred while executing this command.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * Handle incoming Prefix Command Message
 */
async function handlePrefixCommand(message, client) {
  if (!message.guild || message.author.bot || message.webhookId) return false;

  const guildConfig = await db.commandsConfig.get(message.guild.id);
  const serverPrefix = guildConfig.prefix || '!';
  const secondaryPrefixes = guildConfig.secondaryPrefixes || [];
  const allPrefixes = [serverPrefix, ...secondaryPrefixes];

  const content = message.content.trim();
  let usedPrefix = null;

  // 1. Check Standard & Secondary Prefixes
  for (const p of allPrefixes) {
    if (content.startsWith(p)) {
      usedPrefix = p;
      break;
    }
  }

  // 2. Check Bot Mention Prefix (@Bot <command>)
  if (!usedPrefix && (guildConfig.allowMentionPrefix !== false)) {
    const mentionRegex = new RegExp(`^<@!?${client.user.id}>\\s*`);
    const match = content.match(mentionRegex);
    if (match) {
      usedPrefix = match[0];
    }
  }

  if (!usedPrefix) return false;

  const rawArgs = content.slice(usedPrefix.length).trim().split(/\s+/);
  const commandSearch = rawArgs.shift()?.toLowerCase();
  if (!commandSearch) return false;

  const command = resolveCommand(client, commandSearch, guildConfig);
  if (!command) return false;

  const ctx = new CommandContext({
    message,
    args: rawArgs,
    prefix: usedPrefix,
    commandName: command.data.name
  });

  // Permission & Cooldown Validation
  const validation = await validateExecution(ctx, command, guildConfig);
  if (!validation.allowed) {
    await ctx.reply({ content: `🚫 ${validation.reason}` });
    return true;
  }

  // Trigger Message Deletion Option
  const cmdConfig = guildConfig?.commands?.[command.data.name] || {};
  if (cmdConfig.deleteTrigger && message.deletable) {
    message.delete().catch(() => {});
  }

  try {
    await command.execute(ctx);
  } catch (err) {
    logger.error(`Error executing prefix command ${usedPrefix}${commandSearch}`, err, 'COMMAND_ROUTER');
    await ctx.reply({ content: '❌ An unexpected error occurred while executing this command.' }).catch(() => {});
  }

  return true;
}

module.exports = {
  resolveCommand,
  handleSlashCommand,
  handlePrefixCommand
};
