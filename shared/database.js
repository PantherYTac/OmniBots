/**
 * Unified Multi-Adapter Shared Database Layer
 * Supports:
 *  1. MongoDB (via Mongoose)
 *  2. PostgreSQL / Supabase (via pg Pool + JSONB storage)
 *  3. Local High-Performance Atomic JSON Store (Zero-config instant local fallback)
 */

const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const {
  createDefaultLegalDocuments,
  getDefaultPrivacyPolicy,
  getDefaultTermsOfService
} = require('./utils/legalTemplates');

let dbDriver = 'local'; // 'mongodb' | 'postgres' | 'local'
let pgPool = null;
let mongooseClient = null;

// Local file store path
const dataDir = path.join(__dirname, 'data');
const localStorePath = path.join(dataDir, 'store.json');

// In-memory cache for local JSON store
let memoryStore = {
  guildSettings: {},
  infractions: [],
  stickyRoles: {},
  userLevels: {},
  economy: {},
  shopItems: [],
  tickets: [],
  customCommands: [],
  suggestions: [],
  giveaways: [],
  starboard: {},
  auditLogs: [],
  sessions: {},
  botSettings: null,
  invites: {},
  inviteMembers: {},
  legalDocuments: null
};

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing local data if present
if (fs.existsSync(localStorePath)) {
  try {
    const raw = fs.readFileSync(localStorePath, 'utf8');
    memoryStore = { ...memoryStore, ...JSON.parse(raw) };
  } catch (err) {
    logger.warn('Could not parse local store.json, starting with fresh store.', 'DATABASE');
  }
}

/**
 * Persist memory store to disk atomically
 */
function saveLocalStore() {
  try {
    const tempPath = `${localStorePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(memoryStore, null, 2), 'utf8');
    fs.renameSync(tempPath, localStorePath);
  } catch (err) {
    logger.error('Failed to write local store.json', err, 'DATABASE');
  }
}

/**
 * Default Global Bot Presence Settings Factory
 */
function createDefaultBotSettings() {
  return {
    status: 'online',
    rotationEnabled: false,
    rotationIntervalSeconds: 30,
    activities: [
      {
        type: 'CUSTOM',
        text: '⚡ Protecting {servers} servers with {users} users',
        url: ''
      }
    ],
    updatedAt: Date.now()
  };
}

/**
 * Default Guild Settings Factory
 */
function createDefaultGuildSettings(guildId) {
  return {
    guildId,
    prefix: '!',
    language: 'en',
    embedColor: '#5865F2',
    modules: {
      moderation: true,
      automod: true,
      logging: true,
      reactionRoles: true,
      tickets: true,
      leveling: true,
      economy: true,
      starboard: true,
      suggestions: true,
      giveaways: true,
      tempVoice: true,
      counting: true,
      birthdays: true,
      aiChat: true,
      inviteTracker: true
    },
    automod: {
      antiInvites: true,
      antiLinks: false,
      antiSpam: true,
      antiMassMentions: true,
      mentionThreshold: 5,
      antiEmojiSpam: true,
      emojiThreshold: 8,
      bannedWords: ['discord.gg/hacked', 'free-nitro', 'grabify', 'iplogger'],
      ignoredChannels: [],
      ignoredRoles: [],
      punishment: 'delete_warn',
      escalation: [
        { warns: 3, action: 'timeout', duration: '1h' },
        { warns: 5, action: 'kick' },
        { warns: 7, action: 'ban' }
      ]
    },
    logging: {
      enabled: true,
      logChannelId: '',
      splitChannels: {
        modLogs: '',
        messageLogs: '',
        memberLogs: '',
        voiceLogs: ''
      }
    },
    verification: {
      enabled: false,
      channelId: '',
      verifiedRoleId: '',
      messageId: '',
      captchaType: 'button'
    },
    stickyRoles: {
      enabled: true
    },
    reactionRoles: [],
    welcome: {
      enabled: false,
      channelId: '',
      message: 'Welcome {user} to **{server}**! You are member #{member_count}. 🎉',
      sendCard: true
    },
    farewell: {
      enabled: false,
      channelId: '',
      message: '{user} has left the server. Goodbye! 👋'
    },
    autoroles: {
      memberRoles: [],
      botRoles: []
    },
    voiceRoles: [],
    tickets: {
      enabled: true,
      categoryId: '',
      supportRoleId: '',
      logChannelId: '',
      categories: [
        { id: 'general', label: 'General Support', emoji: '🎫', description: 'Assistance with server questions' },
        { id: 'billing', label: 'Billing & Shop', emoji: '💳', description: 'Help with server store & perks' },
        { id: 'report', label: 'Player Report', emoji: '🚨', description: 'Report bad behavior or rule-breaking' }
      ]
    },
    leveling: {
      enabled: true,
      xpRate: 1.0,
      announcementChannelId: '',
      message: 'Congratulations {user}, you leveled up to **Level {level}**! 🚀',
      levelRoles: []
    },
    economy: {
      currencySymbol: '🪙',
      currencyName: 'Coins',
      dailyMin: 100,
      dailyMax: 250,
      workMin: 50,
      workMax: 150,
      workCooldownMinutes: 30
    },
    starboard: {
      enabled: true,
      channelId: '',
      threshold: 3,
      emoji: '⭐'
    },
    suggestions: {
      enabled: true,
      channelId: ''
    },
    tempVoice: {
      enabled: false,
      creatorChannelId: '',
      categoryChannelId: ''
    },
    counting: {
      enabled: false,
      channelId: '',
      currentNumber: 0,
      lastUserId: ''
    },
    statChannels: {
      enabled: false,
      memberCountChannelId: '',
      onlineCountChannelId: ''
    },
    inviteTracking: {
      enabled: true,
      minAccountAgeDays: 7,
      subtractLeaves: true,
      rewards: []
    }
  };
}

/**
 * Initialize Database Connection
 */
async function initDatabase() {
  const dbUrl = (process.env.DATABASE_URL || '').trim();

  if (dbUrl.startsWith('mongodb://') || dbUrl.startsWith('mongodb+srv://')) {
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(dbUrl);
      dbDriver = 'mongodb';
      mongooseClient = mongoose;
      logger.success('Connected successfully to MongoDB Database', 'DATABASE');
      return;
    } catch (err) {
      logger.error('MongoDB connection failed. Falling back to local store.', err, 'DATABASE');
    }
  } else if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    try {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
      });
      // Test connection and initialize table
      const client = await pgPool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS shared_collections (
          collection_name VARCHAR(64) NOT NULL,
          doc_id VARCHAR(128) NOT NULL,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (collection_name, doc_id)
        );
        CREATE INDEX IF NOT EXISTS idx_coll_name ON shared_collections (collection_name);
      `);
      client.release();
      dbDriver = 'postgres';
      logger.success('Connected successfully to PostgreSQL/Supabase Database', 'DATABASE');
      return;
    } catch (err) {
      logger.error('PostgreSQL connection failed. Falling back to local store.', err, 'DATABASE');
    }
  }

  dbDriver = 'local';
  logger.info('Using high-performance persistent local JSON database (zero external setup required).', 'DATABASE');
}

/**
 * Database API Object
 */
const db = {
  init: initDatabase,
  getDriver: () => dbDriver,

  // 1. Guild Settings
  guilds: {
    async get(guildId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['guildSettings', guildId]);
        if (res.rows.length > 0) return { ...createDefaultGuildSettings(guildId), ...res.rows[0].data };
      } else if (dbDriver === 'local') {
        const cached = memoryStore.guildSettings[guildId];
        if (cached) return { ...createDefaultGuildSettings(guildId), ...cached };
      }
      const def = createDefaultGuildSettings(guildId);
      await this.set(guildId, def);
      return def;
    },

    async set(guildId, data) {
      const merged = { ...createDefaultGuildSettings(guildId), ...data, guildId };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (collection_name, doc_id)
          DO UPDATE SET data = $3, updated_at = NOW()
        `, ['guildSettings', guildId, merged]);
      } else {
        memoryStore.guildSettings[guildId] = merged;
        saveLocalStore();
      }
      return merged;
    },

    async update(guildId, partial) {
      const current = await this.get(guildId);
      const updated = { ...current, ...partial };
      return this.set(guildId, updated);
    }
  },

  // 2. Infractions & Auto-escalation
  infractions: {
    async add(record) {
      const entry = {
        id: `inf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        ...record
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
        `, ['infractions', entry.id, entry]);
      } else {
        memoryStore.infractions.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async list(guildId, userId = null) {
      if (dbDriver === 'postgres' && pgPool) {
        let q = "SELECT data FROM shared_collections WHERE collection_name = 'infractions' AND data->>'guildId' = $1";
        const params = [guildId];
        if (userId) {
          q += " AND data->>'userId' = $2";
          params.push(userId);
        }
        q += " ORDER BY (data->>'timestamp')::bigint DESC";
        const res = await pgPool.query(q, params);
        return res.rows.map(r => r.data);
      }
      return memoryStore.infractions
        .filter(i => i.guildId === guildId && (!userId || i.userId === userId))
        .sort((a, b) => b.timestamp - a.timestamp);
    },

    async clear(guildId, userId) {
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'infractions' AND data->>'guildId' = $1 AND data->>'userId' = $2", [guildId, userId]);
      } else {
        memoryStore.infractions = memoryStore.infractions.filter(i => !(i.guildId === guildId && i.userId === userId));
        saveLocalStore();
      }
      return true;
    },

    async count(guildId, userId, type = null) {
      const list = await this.list(guildId, userId);
      return type ? list.filter(i => i.type === type).length : list.length;
    }
  },

  // 3. Sticky Roles
  stickyRoles: {
    async get(guildId, userId) {
      const key = `${guildId}_${userId}`;
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['stickyRoles', key]);
        return res.rows.length > 0 ? res.rows[0].data.roles : [];
      }
      return memoryStore.stickyRoles[key] || [];
    },

    async set(guildId, userId, roles) {
      const key = `${guildId}_${userId}`;
      const data = { guildId, userId, roles, updatedAt: Date.now() };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['stickyRoles', key, data]);
      } else {
        memoryStore.stickyRoles[key] = roles;
        saveLocalStore();
      }
    },

    async remove(guildId, userId) {
      const key = `${guildId}_${userId}`;
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('DELETE FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['stickyRoles', key]);
      } else {
        delete memoryStore.stickyRoles[key];
        saveLocalStore();
      }
    }
  },

  // 4. User Levels & XP
  levels: {
    async get(guildId, userId) {
      const key = `${guildId}_${userId}`;
      const def = { guildId, userId, xp: 0, level: 0, messages: 0, voiceMinutes: 0, lastXpEarned: 0 };
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['userLevels', key]);
        if (res.rows.length > 0) return { ...def, ...res.rows[0].data };
      } else if (memoryStore.userLevels[key]) {
        return { ...def, ...memoryStore.userLevels[key] };
      }
      return def;
    },

    async save(guildId, userId, data) {
      const key = `${guildId}_${userId}`;
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['userLevels', key, data]);
      } else {
        memoryStore.userLevels[key] = data;
        saveLocalStore();
      }
      return data;
    },

    async addXp(guildId, userId, amount) {
      const current = await this.get(guildId, userId);
      const { getLevel } = require('./utils/helpers');
      const oldLevel = current.level;
      current.xp += amount;
      current.level = getLevel(current.xp);
      current.messages = (current.messages || 0) + 1;
      current.lastXpEarned = Date.now();
      await this.save(guildId, userId, current);
      return {
        data: current,
        leveledUp: current.level > oldLevel,
        oldLevel,
        newLevel: current.level
      };
    },

    async addVoiceMinutes(guildId, userId, minutes, xpGain = 10) {
      const current = await this.get(guildId, userId);
      const { getLevel } = require('./utils/helpers');
      const oldLevel = current.level;
      current.xp += xpGain;
      current.level = getLevel(current.xp);
      current.voiceMinutes = (current.voiceMinutes || 0) + minutes;
      await this.save(guildId, userId, current);
      return {
        data: current,
        leveledUp: current.level > oldLevel,
        newLevel: current.level
      };
    },

    async getLeaderboard(guildId, limit = 50) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query(`
          SELECT data FROM shared_collections
          WHERE collection_name = 'userLevels' AND data->>'guildId' = $1
          ORDER BY (data->>'xp')::bigint DESC LIMIT $2
        `, [guildId, limit]);
        return res.rows.map(r => r.data);
      }
      return Object.values(memoryStore.userLevels)
        .filter(u => u.guildId === guildId)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, limit);
    }
  },

  // 5. Economy & Shop
  economy: {
    async get(guildId, userId) {
      const key = `${guildId}_${userId}`;
      const def = { guildId, userId, wallet: 100, bank: 0, lastDaily: 0, dailyStreak: 0, lastWork: 0 };
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['economy', key]);
        if (res.rows.length > 0) return { ...def, ...res.rows[0].data };
      } else if (memoryStore.economy[key]) {
        return { ...def, ...memoryStore.economy[key] };
      }
      return def;
    },

    async save(guildId, userId, data) {
      const key = `${guildId}_${userId}`;
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['economy', key, data]);
      } else {
        memoryStore.economy[key] = data;
        saveLocalStore();
      }
      return data;
    },

    async addWallet(guildId, userId, amount) {
      const eco = await this.get(guildId, userId);
      eco.wallet = Math.max(0, (eco.wallet || 0) + amount);
      return this.save(guildId, userId, eco);
    },

    async getLeaderboard(guildId, limit = 50) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query(`
          SELECT data FROM shared_collections
          WHERE collection_name = 'economy' AND data->>'guildId' = $1
          ORDER BY ((data->>'wallet')::bigint + (data->>'bank')::bigint) DESC LIMIT $2
        `, [guildId, limit]);
        return res.rows.map(r => r.data);
      }
      return Object.values(memoryStore.economy)
        .filter(u => u.guildId === guildId)
        .sort((a, b) => ((b.wallet || 0) + (b.bank || 0)) - ((a.wallet || 0) + (a.bank || 0)))
        .slice(0, limit);
    }
  },

  // 6. Shop Items
  shop: {
    async list(guildId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'shopItems' AND data->>'guildId' = $1", [guildId]);
        return res.rows.map(r => r.data);
      }
      return memoryStore.shopItems.filter(i => i.guildId === guildId);
    },

    async add(item) {
      const entry = {
        id: item.id || `item_${Date.now()}`,
        createdAt: Date.now(),
        ...item
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['shopItems', entry.id, entry]);
      } else {
        const idx = memoryStore.shopItems.findIndex(i => i.id === entry.id);
        if (idx >= 0) memoryStore.shopItems[idx] = entry;
        else memoryStore.shopItems.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async remove(guildId, itemId) {
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'shopItems' AND doc_id = $1 AND data->>'guildId' = $2", [itemId, guildId]);
      } else {
        memoryStore.shopItems = memoryStore.shopItems.filter(i => !(i.id === itemId && i.guildId === guildId));
        saveLocalStore();
      }
      return true;
    }
  },

  // 7. Support Tickets & Transcripts
  tickets: {
    async create(ticket) {
      const entry = {
        id: ticket.id || `ticket-${Date.now()}`,
        status: 'open',
        createdAt: Date.now(),
        ...ticket
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('INSERT INTO shared_collections (collection_name, doc_id, data) VALUES ($1, $2, $3)', ['tickets', entry.id, entry]);
      } else {
        memoryStore.tickets.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async get(ticketId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['tickets', ticketId]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.tickets.find(t => t.id === ticketId) || null;
    },

    async getByChannel(channelId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'tickets' AND data->>'channelId' = $1", [channelId]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.tickets.find(t => t.channelId === channelId) || null;
    },

    async update(ticketId, updateData) {
      const current = await this.get(ticketId);
      if (!current) return null;
      const updated = { ...current, ...updateData };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('UPDATE shared_collections SET data = $1 WHERE collection_name = $2 AND doc_id = $3', [updated, 'tickets', ticketId]);
      } else {
        const idx = memoryStore.tickets.findIndex(t => t.id === ticketId);
        if (idx >= 0) memoryStore.tickets[idx] = updated;
        saveLocalStore();
      }
      return updated;
    },

    async list(guildId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'tickets' AND data->>'guildId' = $1 ORDER BY (data->>'createdAt')::bigint DESC", [guildId]);
        return res.rows.map(r => r.data);
      }
      return memoryStore.tickets
        .filter(t => t.guildId === guildId)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  },

  // 8. Custom Commands
  customCommands: {
    async list(guildId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'customCommands' AND data->>'guildId' = $1", [guildId]);
        return res.rows.map(r => r.data);
      }
      return memoryStore.customCommands.filter(c => c.guildId === guildId);
    },

    async get(guildId, trigger) {
      const clean = trigger.toLowerCase().trim();
      const list = await this.list(guildId);
      return list.find(c => c.trigger.toLowerCase() === clean) || null;
    },

    async set(guildId, trigger, response, createdBy = 'Admin') {
      const clean = trigger.toLowerCase().trim();
      const id = `${guildId}_${clean}`;
      const entry = { id, guildId, trigger: clean, response, createdBy, updatedAt: Date.now() };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['customCommands', id, entry]);
      } else {
        const idx = memoryStore.customCommands.findIndex(c => c.id === id);
        if (idx >= 0) memoryStore.customCommands[idx] = entry;
        else memoryStore.customCommands.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async remove(guildId, trigger) {
      const id = `${guildId}_${trigger.toLowerCase().trim()}`;
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('DELETE FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['customCommands', id]);
      } else {
        memoryStore.customCommands = memoryStore.customCommands.filter(c => c.id !== id);
        saveLocalStore();
      }
      return true;
    }
  },

  // 9. Suggestions
  suggestions: {
    async create(data) {
      const entry = {
        id: `sug_${Date.now()}`,
        status: 'pending',
        upvotes: [],
        downvotes: [],
        createdAt: Date.now(),
        ...data
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('INSERT INTO shared_collections (collection_name, doc_id, data) VALUES ($1, $2, $3)', ['suggestions', entry.id, entry]);
      } else {
        memoryStore.suggestions.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async get(id) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['suggestions', id]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.suggestions.find(s => s.id === id) || null;
    },

    async update(id, updateData) {
      const current = await this.get(id);
      if (!current) return null;
      const updated = { ...current, ...updateData };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('UPDATE shared_collections SET data = $1 WHERE collection_name = $2 AND doc_id = $3', [updated, 'suggestions', id]);
      } else {
        const idx = memoryStore.suggestions.findIndex(s => s.id === id);
        if (idx >= 0) memoryStore.suggestions[idx] = updated;
        saveLocalStore();
      }
      return updated;
    }
  },

  // 10. Giveaways
  giveaways: {
    async create(data) {
      const entry = {
        id: data.messageId,
        createdAt: Date.now(),
        ended: false,
        entries: [],
        ...data
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('INSERT INTO shared_collections (collection_name, doc_id, data) VALUES ($1, $2, $3)', ['giveaways', entry.id, entry]);
      } else {
        memoryStore.giveaways.push(entry);
        saveLocalStore();
      }
      return entry;
    },

    async get(messageId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['giveaways', messageId]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.giveaways.find(g => g.id === messageId) || null;
    },

    async getActive() {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'giveaways' AND (data->>'ended')::boolean = false");
        return res.rows.map(r => r.data);
      }
      return memoryStore.giveaways.filter(g => !g.ended);
    },

    async update(messageId, updateData) {
      const current = await this.get(messageId);
      if (!current) return null;
      const updated = { ...current, ...updateData };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('UPDATE shared_collections SET data = $1 WHERE collection_name = $2 AND doc_id = $3', [updated, 'giveaways', messageId]);
      } else {
        const idx = memoryStore.giveaways.findIndex(g => g.id === messageId);
        if (idx >= 0) memoryStore.giveaways[idx] = updated;
        saveLocalStore();
      }
      return updated;
    }
  },

  // 11. Starboard Registry
  starboard: {
    async get(originalMessageId) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query('SELECT data FROM shared_collections WHERE collection_name = $1 AND doc_id = $2', ['starboard', originalMessageId]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.starboard[originalMessageId] || null;
    },

    async set(originalMessageId, data) {
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['starboard', originalMessageId, data]);
      } else {
        memoryStore.starboard[originalMessageId] = data;
        saveLocalStore();
      }
    }
  },

  // 12. Audit & Activity Logs
  auditLogs: {
    async log(guildId, type, description, metadata = {}) {
      const entry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        guildId,
        type,
        description,
        metadata,
        timestamp: Date.now()
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query('INSERT INTO shared_collections (collection_name, doc_id, data) VALUES ($1, $2, $3)', ['auditLogs', entry.id, entry]);
      } else {
        memoryStore.auditLogs.unshift(entry);
        if (memoryStore.auditLogs.length > 2000) memoryStore.auditLogs.pop();
        saveLocalStore();
      }
      return entry;
    },

    async getRecent(guildId, limit = 20) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'auditLogs' AND data->>'guildId' = $1 ORDER BY (data->>'timestamp')::bigint DESC LIMIT $2", [guildId, limit]);
        return res.rows.map(r => r.data);
      }
      return memoryStore.auditLogs
        .filter(l => l.guildId === guildId)
        .slice(0, limit);
    },

    async countToday(guildId, type = null) {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (dbDriver === 'postgres' && pgPool) {
        let q = "SELECT COUNT(*) FROM shared_collections WHERE collection_name = 'auditLogs' AND data->>'guildId' = $1 AND (data->>'timestamp')::bigint >= $2";
        const params = [guildId, oneDayAgo];
        if (type) {
          q += " AND data->>'type' = $3";
          params.push(type);
        }
        const res = await pgPool.query(q, params);
        return parseInt(res.rows[0].count, 10);
      }
      return memoryStore.auditLogs.filter(l => {
        return l.guildId === guildId && l.timestamp >= oneDayAgo && (!type || l.type === type);
      }).length;
    }
  },

  // 13. Persistent Web Sessions
  sessions: {
    async get(sid) {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'sessions' AND doc_id = $1", [sid]);
        return res.rows.length > 0 ? res.rows[0].data : null;
      }
      return memoryStore.sessions[sid] || null;
    },

    async set(sid, sessData, expires) {
      const entry = {
        sid,
        data: sessData,
        expires: expires ? new Date(expires).toISOString() : null,
        updatedAt: Date.now()
      };
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data)
          VALUES ($1, $2, $3)
          ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = $3
        `, ['sessions', sid, entry]);
      } else {
        memoryStore.sessions[sid] = entry;
        saveLocalStore();
      }
      return entry;
    },

    async destroy(sid) {
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'sessions' AND doc_id = $1", [sid]);
      } else {
        delete memoryStore.sessions[sid];
        saveLocalStore();
      }
      return true;
    }
  },

  // 14. Global Bot Presence Settings
  botSettings: {
    async get() {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'botSettings' AND doc_id = 'global'");
        if (res.rows.length > 0) return { ...createDefaultBotSettings(), ...res.rows[0].data };
      } else {
        if (memoryStore.botSettings) return { ...createDefaultBotSettings(), ...memoryStore.botSettings };
      }
      const def = createDefaultBotSettings();
      await this.set(def);
      return def;
    },

    async set(data) {
      const current = memoryStore.botSettings || createDefaultBotSettings();
      const sanitized = {
        ...current,
        ...data,
        status: ['online', 'idle', 'dnd', 'invisible'].includes(data.status) ? data.status : (current.status || 'online'),
        rotationEnabled: typeof data.rotationEnabled === 'boolean' ? data.rotationEnabled : (current.rotationEnabled ?? false),
        rotationIntervalSeconds: Math.max(15, parseInt(data.rotationIntervalSeconds, 10) || 30),
        activities: Array.isArray(data.activities) && data.activities.length > 0 ? data.activities : (current.activities || []),
        updatedAt: Date.now()
      };

      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data, updated_at)
          VALUES ('botSettings', 'global', $1, NOW())
          ON CONFLICT (collection_name, doc_id)
          DO UPDATE SET data = $1, updated_at = NOW()
        `, [sanitized]);
      } else {
        memoryStore.botSettings = sanitized;
        saveLocalStore();
      }
      return sanitized;
    }
  },

  // 15. Server Invites Tracker
  invites: {
    async get(guildId, userId) {
      const key = `${guildId}_${userId}`;
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'invites' AND doc_id = $1", [key]);
        if (res.rows.length > 0) return res.rows[0].data;
      } else {
        if (memoryStore.invites[key]) return memoryStore.invites[key];
      }
      return {
        guildId,
        userId,
        regular: 0,
        bonus: 0,
        leaves: 0,
        fake: 0,
        total: 0,
        updatedAt: Date.now()
      };
    },

    async save(guildId, userId, data) {
      const key = `${guildId}_${userId}`;
      const entry = {
        guildId,
        userId,
        regular: Math.max(0, parseInt(data.regular, 10) || 0),
        bonus: parseInt(data.bonus, 10) || 0,
        leaves: Math.max(0, parseInt(data.leaves, 10) || 0),
        fake: Math.max(0, parseInt(data.fake, 10) || 0),
        total: Math.max(0, parseInt(data.total, 10) || 0),
        updatedAt: Date.now()
      };

      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data, updated_at)
          VALUES ('invites', $1, $2, NOW())
          ON CONFLICT (collection_name, doc_id)
          DO UPDATE SET data = $2, updated_at = NOW()
        `, [key, entry]);
      } else {
        memoryStore.invites[key] = entry;
        saveLocalStore();
      }
      return entry;
    },

    async recordJoin(guildId, userId, isFake = false) {
      const record = await this.get(guildId, userId);
      record.total = (record.total || 0) + 1;
      if (isFake) {
        record.fake = (record.fake || 0) + 1;
      } else {
        record.regular = (record.regular || 0) + 1;
      }
      return this.save(guildId, userId, record);
    },

    async recordLeave(guildId, userId) {
      const record = await this.get(guildId, userId);
      record.leaves = (record.leaves || 0) + 1;
      return this.save(guildId, userId, record);
    },

    async addBonus(guildId, userId, amount) {
      const record = await this.get(guildId, userId);
      record.bonus = (record.bonus || 0) + parseInt(amount, 10);
      return this.save(guildId, userId, record);
    },

    async reset(guildId, userId = null) {
      if (userId) {
        const resetData = {
          guildId,
          userId,
          regular: 0,
          bonus: 0,
          leaves: 0,
          fake: 0,
          total: 0,
          updatedAt: Date.now()
        };
        return this.save(guildId, userId, resetData);
      }

      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'invites' AND data->>'guildId' = $1", [guildId]);
      } else {
        for (const k of Object.keys(memoryStore.invites)) {
          if (k.startsWith(`${guildId}_`)) {
            delete memoryStore.invites[k];
          }
        }
        saveLocalStore();
      }
      return true;
    },

    async getLeaderboard(guildId, limit = 100) {
      let list = [];
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'invites' AND data->>'guildId' = $1", [guildId]);
        list = res.rows.map(r => r.data);
      } else {
        list = Object.values(memoryStore.invites).filter(item => item && item.guildId === guildId);
      }

      return list
        .map(item => {
          const regular = item.regular || 0;
          const bonus = item.bonus || 0;
          const leaves = item.leaves || 0;
          const fake = item.fake || 0;
          const net = regular + bonus - leaves;
          return {
            ...item,
            regular,
            bonus,
            leaves,
            fake,
            net
          };
        })
        .sort((a, b) => b.net - a.net)
        .slice(0, limit);
    }
  },

  // 16. Joined Member Attribution (Tracks who invited which member)
  inviteMembers: {
    async get(guildId, memberId) {
      const key = `${guildId}_${memberId}`;
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'inviteMembers' AND doc_id = $1", [key]);
        if (res.rows.length > 0) return res.rows[0].data;
      } else {
        if (memoryStore.inviteMembers[key]) return memoryStore.inviteMembers[key];
      }
      return null;
    },

    async set(guildId, memberId, data) {
      const key = `${guildId}_${memberId}`;
      const entry = {
        guildId,
        memberId,
        inviterId: data.inviterId || 'UNKNOWN',
        code: data.code || null,
        isFake: Boolean(data.isFake),
        joinedAt: data.joinedAt || Date.now()
      };

      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data, updated_at)
          VALUES ('inviteMembers', $1, $2, NOW())
          ON CONFLICT (collection_name, doc_id)
          DO UPDATE SET data = $2, updated_at = NOW()
        `, [key, entry]);
      } else {
        memoryStore.inviteMembers[key] = entry;
        saveLocalStore();
      }
      return entry;
    },

    async remove(guildId, memberId) {
      const key = `${guildId}_${memberId}`;
      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'inviteMembers' AND doc_id = $1", [key]);
      } else {
        delete memoryStore.inviteMembers[key];
        saveLocalStore();
      }
      return true;
    }
  },

  // 17. Discord Verification-Compliant Legal Documents
  legalDocuments: {
    async get() {
      if (dbDriver === 'postgres' && pgPool) {
        const res = await pgPool.query("SELECT data FROM shared_collections WHERE collection_name = 'legalDocuments' AND doc_id = 'global'");
        if (res.rows.length > 0) return res.rows[0].data;
      } else {
        if (memoryStore.legalDocuments) return memoryStore.legalDocuments;
      }
      const def = createDefaultLegalDocuments();
      await this.set(def);
      return def;
    },

    async set(data) {
      const current = (dbDriver === 'local' ? memoryStore.legalDocuments : null) || createDefaultLegalDocuments();
      const contactEmail = data.contactEmail || current.contactEmail || 'support@yourdomain.com';
      const supportServerInvite = data.supportServerInvite || current.supportServerInvite || 'https://discord.gg/yourserver';

      const entry = {
        privacyPolicy: {
          content: data.privacyPolicy?.content || (typeof data.privacyPolicy === 'string' ? data.privacyPolicy : current.privacyPolicy?.content || getDefaultPrivacyPolicy(contactEmail, supportServerInvite)),
          updatedAt: data.privacyPolicy?.updatedAt || new Date().toISOString()
        },
        termsOfService: {
          content: data.termsOfService?.content || (typeof data.termsOfService === 'string' ? data.termsOfService : current.termsOfService?.content || getDefaultTermsOfService(contactEmail, supportServerInvite)),
          updatedAt: data.termsOfService?.updatedAt || new Date().toISOString()
        },
        contactEmail,
        supportServerInvite,
        updatedAt: new Date().toISOString()
      };

      if (dbDriver === 'postgres' && pgPool) {
        await pgPool.query(`
          INSERT INTO shared_collections (collection_name, doc_id, data, updated_at)
          VALUES ('legalDocuments', 'global', $1, NOW())
          ON CONFLICT (collection_name, doc_id)
          DO UPDATE SET data = $1, updated_at = NOW()
        `, [entry]);
      } else {
        memoryStore.legalDocuments = entry;
        saveLocalStore();
      }
      return entry;
    },

    async resetToDefault(contactEmail, supportServer) {
      const email = contactEmail || 'support@yourdomain.com';
      const support = supportServer || 'https://discord.gg/yourserver';
      const def = createDefaultLegalDocuments(email, support);
      return this.set(def);
    }
  },

  // 18. GDPR / Discord Developer Policy User Data Deletion Engine
  compliance: {
    async deleteUserData(userId) {
      if (!userId) throw new Error('User ID is required for data deletion');

      const result = {
        userId,
        levelsPurged: 0,
        economyPurged: 0,
        invitesPurged: 0,
        memberAttributionPurged: 0,
        stickyRolesPurged: 0,
        birthdaysPurged: 0,
        infractionsPurged: 0,
        timestamp: Date.now()
      };

      if (dbDriver === 'postgres' && pgPool) {
        // Levels
        const lRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'userLevels' AND (doc_id LIKE '%' || $1 OR data->>'userId' = $1)", [userId]);
        result.levelsPurged = lRes.rowCount || 0;

        // Economy
        const eRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'economy' AND (doc_id LIKE '%' || $1 OR data->>'userId' = $1)", [userId]);
        result.economyPurged = eRes.rowCount || 0;

        // Invites
        const iRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'invites' AND (doc_id LIKE '%' || $1 OR data->>'userId' = $1)", [userId]);
        result.invitesPurged = iRes.rowCount || 0;

        // Member Attribution
        const maRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'inviteMembers' AND (doc_id LIKE '%' || $1 OR data->>'memberId' = $1)", [userId]);
        result.memberAttributionPurged = maRes.rowCount || 0;

        // Sticky Roles
        const sRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'stickyRoles' AND (doc_id LIKE '%' || $1)", [userId]);
        result.stickyRolesPurged = sRes.rowCount || 0;

        // Infractions
        const infRes = await pgPool.query("DELETE FROM shared_collections WHERE collection_name = 'infractions' AND data->>'targetId' = $1", [userId]);
        result.infractionsPurged = infRes.rowCount || 0;

        // Birthdays in guildSettings
        const gRes = await pgPool.query("SELECT doc_id, data FROM shared_collections WHERE collection_name = 'guildSettings' AND data->'birthdays' ? $1", [userId]);
        for (const row of gRes.rows) {
          const gData = row.data;
          if (gData.birthdays && gData.birthdays[userId]) {
            delete gData.birthdays[userId];
            await pgPool.query("UPDATE shared_collections SET data = $1 WHERE collection_name = 'guildSettings' AND doc_id = $2", [gData, row.doc_id]);
            result.birthdaysPurged++;
          }
        }
      } else {
        // Local Store
        // 1. Levels
        for (const key of Object.keys(memoryStore.userLevels)) {
          if (key.endsWith(`_${userId}`) || memoryStore.userLevels[key]?.userId === userId) {
            delete memoryStore.userLevels[key];
            result.levelsPurged++;
          }
        }

        // 2. Economy
        for (const key of Object.keys(memoryStore.economy)) {
          if (key.endsWith(`_${userId}`) || memoryStore.economy[key]?.userId === userId) {
            delete memoryStore.economy[key];
            result.economyPurged++;
          }
        }

        // 3. Invites
        for (const key of Object.keys(memoryStore.invites)) {
          if (key.endsWith(`_${userId}`) || memoryStore.invites[key]?.userId === userId) {
            delete memoryStore.invites[key];
            result.invitesPurged++;
          }
        }

        // 4. Invite Members
        for (const key of Object.keys(memoryStore.inviteMembers)) {
          if (key.endsWith(`_${userId}`) || memoryStore.inviteMembers[key]?.memberId === userId) {
            delete memoryStore.inviteMembers[key];
            result.memberAttributionPurged++;
          }
        }

        // 5. Sticky Roles
        for (const key of Object.keys(memoryStore.stickyRoles)) {
          if (key.endsWith(`_${userId}`)) {
            delete memoryStore.stickyRoles[key];
            result.stickyRolesPurged++;
          }
        }

        // 6. Infractions
        const beforeInf = memoryStore.infractions.length;
        memoryStore.infractions = memoryStore.infractions.filter(inf => inf.targetId !== userId);
        result.infractionsPurged = beforeInf - memoryStore.infractions.length;

        // 7. Birthdays
        for (const gid of Object.keys(memoryStore.guildSettings)) {
          if (memoryStore.guildSettings[gid]?.birthdays?.[userId]) {
            delete memoryStore.guildSettings[gid].birthdays[userId];
            result.birthdaysPurged++;
          }
        }

        saveLocalStore();
      }

      logger.info(`Completed user data purge for User ID ${userId}`, 'COMPLIANCE');
      return result;
    }
  }
};

module.exports = db;
