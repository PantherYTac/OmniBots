/**
 * Authentication Routes
 * 1. Dedicated Master Admin Login Gate (/login) with brute-force rate limiter
 * 2. Session fixation protected authentication (req.session.regenerate)
 * 3. Secure session destruction (/logout)
 * 4. Post-authentication Discord OAuth2 linking (/auth/discord)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { db } = require('../../shared');
const { verifyAdminCredentials, requireAdminAuth } = require('../middleware/auth');
const logger = require('../../shared/utils/logger');

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

// 0. Zero-Env First-Run Setup Wizard Routes (/setup)
router.get('/setup', async (req, res) => {
  const hasAdmin = await db.admin.hasAdmin();
  if (hasAdmin) {
    return res.redirect('/login?notice=Master+admin+already+configured');
  }

  const error = req.query.error ? String(req.query.error) : null;
  res.render('setup', { error });
});

router.post('/setup', async (req, res) => {
  const hasAdmin = await db.admin.hasAdmin();
  if (hasAdmin) {
    return res.status(403).render('error', {
      status: 403,
      message: 'Setup has already been completed. Master administrator account exists.',
      user: { username: 'Administrator' }
    });
  }

  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const confirmPassword = req.body.confirmPassword || '';

  if (!username || !password || !confirmPassword) {
    return res.status(400).render('setup', {
      error: 'All fields are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).render('setup', {
      error: 'Password must be at least 8 characters long.'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('setup', {
      error: 'Passwords do not match. Please re-enter.'
    });
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).render('setup', {
      error: 'Password exceeds maximum allowable security limit of 72 bytes.'
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.admin.createAdmin(username, passwordHash);
    logger.success(`Master administrator account created for user "${username}" during first-run setup.`, 'SETUP_WIZARD');

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error after setup', err, 'SETUP');
        return res.redirect('/login?notice=Account+created+successfully.+Please+log+in.');
      }

      req.session.isAdmin = true;
      req.session.username = username;
      req.session.user = {
        id: 'master_admin',
        username: username,
        global_name: 'Master Administrator'
      };

      return res.redirect('/dashboard/bots?notice=Welcome+to+OmniBots!+Add+your+first+bot+below.');
    });
  } catch (err) {
    logger.error('Failed to create master admin during setup', err, 'SETUP_WIZARD');
    return res.status(500).render('setup', {
      error: 'Failed to save master admin account. Please try again.'
    });
  }
});

// Brute-force protection: Max 5 failed login attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
  handler: (req, res) => {
    logger.warn(`Brute-force limit reached on /login from IP ${req.ip}`, 'SECURITY');
    return res.status(429).render('login', {
      error: 'Too many failed login attempts from this IP. Access locked for 15 minutes for your protection.'
    });
  }
});

// 1. GET /login — Render Dark-Mode Admin Login Gate
router.get('/login', async (req, res) => {
  const hasAdmin = await db.admin.hasAdmin();
  if (!hasAdmin) {
    return res.redirect('/setup');
  }

  if (req.session && req.session.isAdmin === true) {
    return res.redirect('/dashboard');
  }

  const notice = req.query.notice ? String(req.query.notice) : null;
  const error = req.query.error ? String(req.query.error) : null;

  res.render('login', { error, notice });
});

// 2. POST /login — Constant-Time Bcrypt Verification & Session Fixation Protection
router.post('/login', loginRateLimiter, async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    return res.status(400).render('login', {
      error: 'Both Master Username and Password are required.'
    });
  }

  // Safe input validation: block passwords over 72 bytes to avoid bcrypt truncation
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).render('login', {
      error: 'Password exceeds maximum allowable security limit of 72 bytes.'
    });
  }

  // Constant-time credential check (bcrypt.compare)
  const isValid = await verifyAdminCredentials(username, password);

  if (!isValid) {
    logger.warn(`Failed master login attempt for username "${username}" from IP ${req.ip}`, 'SECURITY');
    return res.status(401).render('login', {
      error: 'Invalid master username or password. Check your .env configuration.'
    });
  }

  logger.success(`Master Admin successfully authenticated: "${username}" from IP ${req.ip}`, 'SECURITY');

  // Prevent Session Fixation: Regenerate session ID upon successful login
  const returnTo = req.session.returnTo || '/dashboard';

  req.session.regenerate((err) => {
    if (err) {
      logger.error('Failed to regenerate session ID', err, 'SECURITY');
      return res.status(500).render('login', {
        error: 'Session initialization error. Please try again.'
      });
    }

    req.session.isAdmin = true;
    req.session.username = username;
    req.session.user = {
      id: 'master_admin',
      username: username,
      global_name: 'Master Administrator'
    };

    return res.redirect(returnTo);
  });
});

// 3. POST & GET /logout — Destroy Session and Clear Cookie
const handleLogout = (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      res.clearCookie('connect.sid');
      return res.redirect('/login?notice=Logged+out+successfully');
    });
  } else {
    res.clearCookie('connect.sid');
    return res.redirect('/login');
  }
};

router.post('/logout', handleLogout);
router.get('/logout', handleLogout);

// 4. Optional: Post-Login Discord OAuth2 Linking (Accessible ONLY after passing Master Login)
router.get('/auth/discord', requireAdminAuth, async (req, res) => {
  try {
    const oauth = await db.oauthConfig.get();
    const clientId = oauth.clientId;
    const redirectUri = oauth.redirectUri || process.env.CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/discord/callback`;

    if (!clientId || !oauth.hasSecret) {
      return res.redirect('/dashboard?setup_oauth=1&notice=' + encodeURIComponent('Please configure your Bot Client ID & Client Secret in Discord OAuth Settings to link your account.'));
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      prompt: 'consent'
    });

    return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  } catch (err) {
    logger.error('Error starting Discord OAuth flow', err, 'AUTH');
    return res.redirect('/dashboard?error=' + encodeURIComponent('Failed to initiate Discord OAuth flow.'));
  }
});

router.get('/auth/discord/callback', requireAdminAuth, async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/dashboard?error=no_code');
  }

  try {
    const oauth = await db.oauthConfig.get();
    const clientId = oauth.clientId;
    const clientSecret = oauth.clientSecret;
    const redirectUri = oauth.redirectUri || process.env.CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/discord/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect('/dashboard?setup_oauth=1&error=' + encodeURIComponent('Discord OAuth credentials not found. Please configure them in Settings.'));
    }

    const tokenResponse = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Failed to exchange authorization code';
      logger.error('OAuth token exchange failed', tokenData, 'AUTH');
      return res.redirect('/dashboard?setup_oauth=1&error=' + encodeURIComponent(`OAuth Token Error: ${errMsg}`));
    }

    // Fetch User Profile & Guilds
    const userRes = await fetch(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const discordUser = await userRes.json();

    const guildsRes = await fetch(`${DISCORD_API_ENDPOINT}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const guildsData = await guildsRes.json();

    // Attach Discord identity to existing Master Admin session
    req.session.discordUser = discordUser;
    req.session.guilds = Array.isArray(guildsData) ? guildsData : [];
    req.session.user = {
      ...req.session.user,
      id: discordUser.id,
      global_name: discordUser.global_name || discordUser.username,
      avatar: discordUser.avatar
    };

    logger.success(`Linked Discord user @${discordUser.username} (${discordUser.id}) to admin session`, 'AUTH');
    return res.redirect('/dashboard?notice=' + encodeURIComponent(`Discord account @${discordUser.username} linked successfully!`));
  } catch (err) {
    logger.error('Error during Discord account linking callback', err, 'AUTH');
    return res.redirect('/dashboard?error=discord_link_failed');
  }
});

router.post('/auth/discord/unlink', requireAdminAuth, (req, res) => {
  const oldUsername = req.session.discordUser?.username || 'Discord user';
  delete req.session.discordUser;
  delete req.session.guilds;
  if (req.session.user) {
    delete req.session.user.avatar;
    delete req.session.user.global_name;
    delete req.session.user.id;
  }
  logger.info(`Unlinked Discord user ${oldUsername} from admin session`, 'AUTH');
  return res.redirect('/dashboard?notice=' + encodeURIComponent('Discord account unlinked from dashboard.'));
});

module.exports = router;
