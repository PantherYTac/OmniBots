/**
 * OmniBots - Zero-Env Configuration & Cryptographic Security Engine
 * Auto-generates local secrets and AES-256-GCM keys on first boot in /data/config.json.
 * Zero required environment variables at deployment time.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolve /data directory at project root
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const configFilePath = path.join(dataDir, 'config.json');

// Ensure /data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let cachedConfig = null;

/**
 * Initialize or load runtime config from /data/config.json
 */
function loadOrCreateConfig() {
  if (cachedConfig) return cachedConfig;

  let loaded = {};
  if (fs.existsSync(configFilePath)) {
    try {
      const raw = fs.readFileSync(configFilePath, 'utf8');
      loaded = JSON.parse(raw);
    } catch {
      loaded = {};
    }
  }

  // Generate cryptographic keys if absent
  let needsSave = false;
  if (!loaded.SESSION_SECRET) {
    loaded.SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
    needsSave = true;
  }
  if (!loaded.ENCRYPTION_KEY) {
    loaded.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    needsSave = true;
  }
  if (!loaded.PORT) {
    loaded.PORT = parseInt(process.env.PORT, 10) || 3000;
  }
  if (!loaded.APP_NAME) {
    loaded.APP_NAME = 'OmniBots';
    needsSave = true;
  }

  if (needsSave) {
    try {
      fs.writeFileSync(configFilePath, JSON.stringify(loaded, null, 2), 'utf8');
    } catch (err) {
      console.error('[CONFIG] Warning: Could not persist /data/config.json:', err.message);
    }
  }

  cachedConfig = loaded;
  return loaded;
}

const config = loadOrCreateConfig();

/**
 * Encrypt sensitive bot tokens with AES-256-GCM
 */
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `enc_v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted tokens
 */
function decrypt(encryptedInput) {
  if (!encryptedInput) return null;
  try {
    let ivHex, tagHex, dataHex;

    if (typeof encryptedInput === 'string' && encryptedInput.startsWith('enc_v1:')) {
      const parts = encryptedInput.split(':');
      if (parts.length !== 4) return null;
      ivHex = parts[1];
      tagHex = parts[2];
      dataHex = parts[3];
    } else if (typeof encryptedInput === 'object' && encryptedInput.iv && encryptedInput.tag && encryptedInput.data) {
      ivHex = encryptedInput.iv;
      tagHex = encryptedInput.tag;
      dataHex = encryptedInput.data;
    } else {
      return null;
    }

    const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO] Failed to decrypt token:', err.message);
    return null;
  }
}

/**
 * Update config in /data/config.json
 */
function updateConfig(partial) {
  cachedConfig = { ...cachedConfig, ...partial };
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(cachedConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('[CONFIG] Error updating /data/config.json:', err.message);
  }
  return cachedConfig;
}

module.exports = {
  config,
  SESSION_SECRET: config.SESSION_SECRET,
  ENCRYPTION_KEY: config.ENCRYPTION_KEY,
  dataDir,
  encrypt,
  decrypt,
  updateConfig
};
