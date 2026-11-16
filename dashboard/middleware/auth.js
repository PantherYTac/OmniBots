/**
 * Master Admin Authentication & Access Control Middleware
 * Locks down all dashboard routes and API endpoints behind pre-planted .env credentials
 */

const logger = require('../../shared/utils/logger');
const { db } = require('../../shared');
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
  if (envPlaintext && envPlaintext !== 'change_this_master_password_immediately' && bcrypt) {
    logger.warn('ADMIN_PASSWORD_HASH not found. Auto-hashing fallback ADMIN_PASSWORD with bcrypt (SALT_ROUNDS = 12)...', 'SECURITY');
    cachedAdminHash = bcrypt.hashSync(envPlaintext, 12);
    return;
  }
}

/**
 * Verify Master Admin Credentials
 * Checks database-stored admin records first, then falls back to .env
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

  if (!bcrypt) {
    try {
      bcrypt = require('bcryptjs');
    } catch {
      logger.error('bcryptjs is unavailable.', null, 'SECURITY');
      return false;
    }
  }

  // 1. Check Database Admin Account
  try {
    const adminRecord = await db.admin.getAdmin(username);
    if (adminRecord && adminRecord.passwordHash) {
      return await bcrypt.compare(password, adminRecord.passwordHash);
    }
  } catch (err) {
    logger.error('Error fetching admin record from database', err, 'SECURITY');
  }

  // 2. Fallback to Environment Variables check
  if (username.trim().toLowerCase() !== configuredAdminUser.toLowerCase()) {
    return false;
  }

  if (!cachedAdminHash) {
    initAdminCredentials();
  }

  if (cachedAdminHash) {
    try {
      return await bcrypt.compare(password, cachedAdminHash);
    } catch (err) {
      logger.error('Error during bcrypt password verification', err, 'SECURITY');
      return false;
    }
  }

  return false;
}

/**
 * Global Route Protection Middleware: requireAdminAuth
 * Protects every dashboard page and API endpoint.
 * Redirects to /setup if no admin exists yet (Zero-Env First-Run Wizard).
 * Unauthenticated users are redirected to /login (or return 401 JSON for /api/*).
 */
async function requireAdminAuth(req, res, next) {
  const hasAdmin = await db.admin.hasAdmin();

  // If no admin account exists yet, force First-Run Setup Wizard
  if (!hasAdmin) {
    if (req.path === '/setup' || req.originalUrl.startsWith('/setup')) {
      return next();
    }
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        setupRequired: true,
        error: 'First-Run Setup Required: Please navigate to /setup to initialize master admin credentials.'
      });
    }
    return res.redirect('/setup');
  }

  // Block /setup once admin exists
  if (req.path === '/setup' || req.originalUrl === '/setup') {
    return res.status(403).render('error', {
      status: 403,
      message: 'Setup has already been completed. Master administrator account exists.',
      user: req.session?.user || { username: 'Administrator' }
    });
  }

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
 * Once authenticated with master admin credentials, allows managing server modules smoothly.
 */
async function canManageGuild(req, res, next) {
  const guildId = req.params.guildId;
  if (!guildId) return res.redirect('/dashboard');

  const { getGuildDetails, isBotInGuild } = require('./botClient');
  const details = await getGuildDetails(guildId).catch(() => null);

  req.guild = details || { id: guildId, name: `Server (${guildId})` };
  next();
}

module.exports = {
  initAdminCredentials,
  verifyAdminCredentials,
  requireAdminAuth,
  canManageGuild
};
