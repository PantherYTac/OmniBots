/**
 * Master Admin Authentication & Access Control Middleware
 * Locks down all dashboard routes and API endpoints behind pre-planted .env credentials
 */

const logger = require('../../shared/utils/logger');
const { isBotInGuild } = require('./botClient');

let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch {
  // If bcryptjs is not yet installed in sandbox, lazy warning
}

let cachedAdminHash = null;
let configuredAdminUser = 'admin';

/**
 * Initialize and pre-hash admin credentials from .env at startup
 */
function initAdminCredentials() {
  if (!bcrypt) {
    try {
      bcrypt = require('bcryptjs');
    } catch {
      logger.error('bcryptjs is not installed. Please run "npm install".', null, 'AUTH_INIT');
    }
  }

  configuredAdminUser = (process.env.ADMIN_USERNAME || 'admin').trim();

  // 1. Check for pre-computed bcrypt hash
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (envHash) {
    cachedAdminHash = envHash;
    logger.success(`Master Admin authentication initialized for user "${configuredAdminUser}" using pre-planted bcrypt hash.`, 'SECURITY');
    return;
  }

  // 2. Check for fallback plaintext password and auto-hash with SALT_ROUNDS = 12
  const envPlaintext = process.env.ADMIN_PASSWORD;
  if (envPlaintext && bcrypt) {
    logger.warn('ADMIN_PASSWORD_HASH not found. Auto-hashing fallback ADMIN_PASSWORD with bcrypt (SALT_ROUNDS = 12)...', 'SECURITY');
    cachedAdminHash = bcrypt.hashSync(envPlaintext, 12);
    logger.info('Fallback password auto-hashed successfully. For production on Hostinger, generate a hash using "npm run generate-hash" and set ADMIN_PASSWORD_HASH directly.', 'SECURITY');
    return;
  }

  // 3. Emergency secure default if neither is set
  if (bcrypt) {
    const emergencyPass = 'admin_' + Math.random().toString(36).substring(2, 10);
    cachedAdminHash = bcrypt.hashSync(emergencyPass, 12);
    logger.warn(`No ADMIN_PASSWORD_HASH or ADMIN_PASSWORD set in .env! Temporary emergency password for "${configuredAdminUser}": ${emergencyPass}`, 'SECURITY');
  }
}

/**
 * Verify Master Admin Credentials
 * Uses constant-time comparison (bcrypt.compare) and enforces safe input validation (< 72 bytes)
 */
async function verifyAdminCredentials(username, password) {
  if (!username || !password) return false;
  if (typeof username !== 'string' || typeof password !== 'string') return false;

  // Safe input validation: bcrypt only processes up to 72 bytes.
  // Block inputs over 72 bytes to prevent bcrypt truncation vulnerabilities.
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > 72) {
    logger.warn(`Rejected login attempt: Password exceeds 72 bytes (${byteLength} bytes).`, 'SECURITY');
    return false;
  }

  // Verify username (case-insensitive check against configured username)
  if (username.trim().toLowerCase() !== configuredAdminUser.toLowerCase()) {
    return false;
  }

  // Verify password using bcrypt.compare (constant-time check)
  if (!cachedAdminHash) {
    initAdminCredentials();
  }

  if (!bcrypt || !cachedAdminHash) {
    logger.error('Cannot verify password: bcryptjs or cached hash unavailable.', null, 'SECURITY');
    return false;
  }

  try {
    return await bcrypt.compare(password, cachedAdminHash);
  } catch (err) {
    logger.error('Error during bcrypt password verification', err, 'SECURITY');
    return false;
  }
}

/**
 * Global Route Protection Middleware: requireAdminAuth
 * Protects every dashboard page and API endpoint.
 * Unauthenticated users are redirected to /login (or return 401 JSON for /api/*).
 */
function requireAdminAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  // API calls return 401 Unauthorized JSON
  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      error: '401 Unauthorized: Master Admin Authentication Required'
    });
  }

  // Web pages: Save target URL and redirect to login gate
  req.session.returnTo = req.originalUrl !== '/logout' ? req.originalUrl : '/dashboard';
  return res.redirect('/login');
}

/**
 * Guild Permission Middleware
 * Once authenticated with master admin credentials, allows managing any server where the bot is present.
 */
async function canManageGuild(req, res, next) {
  const guildId = req.params.guildId;
  const botActive = await isBotInGuild(guildId);

  if (!botActive) {
    return res.status(404).render('error', {
      status: 404,
      message: `The Discord bot is not present in server ID "${guildId}". Please invite the bot first.`,
      user: { username: configuredAdminUser }
    });
  }

  req.guild = { id: guildId, name: `Guild (${guildId})` };
  next();
}

module.exports = {
  initAdminCredentials,
  verifyAdminCredentials,
  requireAdminAuth,
  canManageGuild
};
