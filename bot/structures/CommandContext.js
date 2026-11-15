/**
 * OmniBots - Unified Dual-Command Context (CommandContext)
 * Seamlessly abstracts ChatInputCommandInteraction (Slash) and Message (Prefix)
 * across all modules with uniform argument parsing and response delivery.
 */

class CommandContext {
  /**
   * @param {Object} options
   * @param {import('discord.js').ChatInputCommandInteraction|null} options.interaction
   * @param {import('discord.js').Message|null} options.message
   * @param {string[]} [options.args]
   * @param {string} [options.prefix]
   * @param {string} [options.commandName]
   */
  constructor({ interaction = null, message = null, args = [], prefix = '!', commandName = '' }) {
    this.interaction = interaction;
    this.message = message;
    this.isSlash = Boolean(interaction);
    this.args = args;
    this.prefix = prefix;
    this.commandName = commandName;

    this.client = interaction ? interaction.client : message.client;
    this.guild = interaction ? interaction.guild : message.guild;
    this.channel = interaction ? interaction.channel : message.channel;
    this.user = interaction ? interaction.user : message.author;
    this.author = this.user;
    this.member = interaction ? interaction.member : message.member;

    this.replied = false;
    this.deferred = false;

    // Check if first argument is a subcommand keyword
    const possibleSub = this.args[0] ? this.args[0].toLowerCase() : null;
    const isSubcommand = !this.isSlash && possibleSub && ['add', 'remove', 'list', 'clear', 'create', 'delete', 'set', 'view'].includes(possibleSub);
    const argOffset = isSubcommand ? 1 : 0;

    // Full synchronous compatibility layer with ChatInputCommandInteraction options
    this.options = {
      getSubcommand: (required = false) => {
        if (this.isSlash) return this.interaction.options.getSubcommand(required);
        return possibleSub || (required ? 'add' : null);
      },
      getUser: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getUser(name, required);
        const mentioned = this.message?.mentions?.users?.first();
        if (mentioned) return mentioned;
        const raw = this.args[argOffset];
        if (!raw) return null;
        const cleanId = raw.replace(/[<@!>]/g, '');
        return this.client.users.cache.get(cleanId) || null;
      },
      getMember: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getMember(name, required);
        const user = this.options.getUser(name, required);
        if (!user || !this.guild) return null;
        return this.guild.members.cache.get(user.id) || null;
      },
      getString: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getString(name, required);
        // If searching for reason or text, join remaining arguments
        if (['reason', 'message', 'text', 'query', 'prompt'].includes(name)) {
          return this.args.slice(argOffset + 1).join(' ').trim() || this.args[argOffset] || null;
        }
        return this.args[argOffset] !== undefined ? this.args[argOffset] : null;
      },
      getInteger: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getInteger(name, required);
        const val = parseInt(this.args[argOffset], 10);
        return isNaN(val) ? null : val;
      },
      getNumber: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getNumber(name, required);
        const val = parseFloat(this.args[argOffset]);
        return isNaN(val) ? null : val;
      },
      getBoolean: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getBoolean(name, required);
        const raw = (this.args[argOffset] || '').toLowerCase();
        if (['true', 'yes', 'on', '1', 'enable'].includes(raw)) return true;
        if (['false', 'no', 'off', '0', 'disable'].includes(raw)) return false;
        return false;
      },
      getChannel: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getChannel(name, required);
        const mentioned = this.message?.mentions?.channels?.first();
        if (mentioned) return mentioned;
        const raw = this.args[argOffset];
        if (!raw) return null;
        const cleanId = raw.replace(/[<#>]/g, '');
        return this.guild ? this.guild.channels.cache.get(cleanId) : null;
      },
      getRole: (name, required = false) => {
        if (this.isSlash) return this.interaction.options.getRole(name, required);
        const mentioned = this.message?.mentions?.roles?.first();
        if (mentioned) return mentioned;
        const raw = this.args[argOffset];
        if (!raw) return null;
        const cleanId = raw.replace(/[<@&>]/g, '');
        return this.guild ? this.guild.roles.cache.get(cleanId) : null;
      }
    };
  }

  /**
   * Universal Reply (handles ephemeral for slash, normal reply for prefix)
   */
  async reply(payload) {
    if (typeof payload === 'string') {
      payload = { content: payload };
    }

    if (this.isSlash) {
      if (this.deferred || this.interaction.deferred) {
        this.replied = true;
        return this.interaction.editReply(payload);
      }
      if (this.replied || this.interaction.replied) {
        return this.interaction.followUp(payload);
      }
      this.replied = true;
      return this.interaction.reply(payload);
    }

    // Prefix message handling: strip ephemeral flag
    const msgPayload = { ...payload };
    delete msgPayload.ephemeral;

    try {
      this.replied = true;
      return await this.message.reply(msgPayload);
    } catch {
      return await this.channel.send(msgPayload);
    }
  }

  /**
   * Defer reply (typing state or interaction defer)
   */
  async deferReply(options = {}) {
    if (this.isSlash) {
      this.deferred = true;
      return this.interaction.deferReply(options);
    }
    this.deferred = true;
    return this.channel.sendTyping().catch(() => {});
  }

  /**
   * Follow up to reply
   */
  async followUp(payload) {
    if (this.isSlash) {
      return this.interaction.followUp(payload);
    }
    const msgPayload = typeof payload === 'string' ? { content: payload } : { ...payload };
    delete msgPayload.ephemeral;
    return this.channel.send(msgPayload);
  }

  /**
   * Edit reply
   */
  async editReply(payload) {
    if (this.isSlash) {
      return this.interaction.editReply(payload);
    }
    const msgPayload = typeof payload === 'string' ? { content: payload } : { ...payload };
    delete msgPayload.ephemeral;
    return this.channel.send(msgPayload);
  }

  /**
   * Extract User
   */
  async getUser(name, index = 0) {
    if (this.isSlash) {
      return this.interaction.options.getUser(name);
    }

    // 1. Mentions
    const mentioned = this.message.mentions.users.first();
    if (mentioned && index === 0) return mentioned;

    // 2. Argument ID or Username
    const raw = this.args[index];
    if (!raw) return null;

    const cleanId = raw.replace(/[<@!>]/g, '');
    if (/^\d{17,20}$/.test(cleanId)) {
      return this.client.users.fetch(cleanId).catch(() => null);
    }

    return null;
  }

  /**
   * Extract Member
   */
  async getMember(name, index = 0) {
    if (!this.guild) return null;
    if (this.isSlash) {
      return this.interaction.options.getMember(name);
    }

    const user = await this.getUser(name, index);
    if (!user) return null;
    return this.guild.members.fetch(user.id).catch(() => null);
  }

  /**
   * Extract String
   */
  getString(name, index = 0, defaultVal = null) {
    if (this.isSlash) {
      return this.interaction.options.getString(name) ?? defaultVal;
    }
    return this.args[index] !== undefined ? this.args[index] : defaultVal;
  }

  /**
   * Extract Integer
   */
  getInteger(name, index = 0, defaultVal = null) {
    if (this.isSlash) {
      return this.interaction.options.getInteger(name) ?? defaultVal;
    }
    const val = parseInt(this.args[index], 10);
    return isNaN(val) ? defaultVal : val;
  }

  /**
   * Extract Number / Float
   */
  getNumber(name, index = 0, defaultVal = null) {
    if (this.isSlash) {
      return this.interaction.options.getNumber(name) ?? defaultVal;
    }
    const val = parseFloat(this.args[index]);
    return isNaN(val) ? defaultVal : val;
  }

  /**
   * Extract Boolean
   */
  getBoolean(name, index = 0, defaultVal = false) {
    if (this.isSlash) {
      return this.interaction.options.getBoolean(name) ?? defaultVal;
    }
    const raw = (this.args[index] || '').toLowerCase();
    if (['true', 'yes', 'on', '1', 'enable'].includes(raw)) return true;
    if (['false', 'no', 'off', '0', 'disable'].includes(raw)) return false;
    return defaultVal;
  }

  /**
   * Extract Channel
   */
  getChannel(name, index = 0) {
    if (this.isSlash) {
      return this.interaction.options.getChannel(name);
    }
    const mentioned = this.message.mentions.channels.first();
    if (mentioned && index === 0) return mentioned;

    const raw = this.args[index];
    if (!raw) return null;
    const cleanId = raw.replace(/[<#>]/g, '');
    return this.guild ? this.guild.channels.cache.get(cleanId) : null;
  }

  /**
   * Extract Role
   */
  getRole(name, index = 0) {
    if (this.isSlash) {
      return this.interaction.options.getRole(name);
    }
    const mentioned = this.message.mentions.roles.first();
    if (mentioned && index === 0) return mentioned;

    const raw = this.args[index];
    if (!raw) return null;
    const cleanId = raw.replace(/[<@&>]/g, '');
    return this.guild ? this.guild.roles.cache.get(cleanId) : null;
  }

  /**
   * Extract Duration (e.g. 10m, 1h, 2d, 30s)
   */
  getDuration(name, index = 0) {
    const raw = this.getString(name, index);
    if (!raw) return null;

    const match = raw.match(/^(\d+)([smhd])$/i);
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let ms = 0;
    if (unit === 's') ms = amount * 1000;
    else if (unit === 'm') ms = amount * 60 * 1000;
    else if (unit === 'h') ms = amount * 60 * 60 * 1000;
    else if (unit === 'd') ms = amount * 24 * 60 * 60 * 1000;

    return {
      raw,
      ms,
      seconds: Math.floor(ms / 1000)
    };
  }

  /**
   * Extract Remaining Text (for reason, message, descriptions)
   */
  getRemainingText(name, startIndex = 0) {
    if (this.isSlash) {
      return this.interaction.options.getString(name) || '';
    }
    return this.args.slice(startIndex).join(' ').trim();
  }
}

module.exports = CommandContext;
