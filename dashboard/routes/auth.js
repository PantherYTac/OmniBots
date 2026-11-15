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
const { verifyAdminCredentials, requireAdminAuth } = require('../middleware/auth');
const logger = require('../../shared/utils/logger');

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

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
router.get('/login', (req, res) => {
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
router.get('/auth/discord', requireAdminAuth, (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = process.env.CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/discord/callback`;

  if (!clientId) {
    return res.status(500).send('CLIENT_ID is not configured in .env');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'consent'
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get('/auth/discord/callback', requireAdminAuth, async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/dashboard?error=no_code');
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/discord/callback`;

  try {
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
      return res.redirect('/dashboard?error=token_failed');
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

    return res.redirect('/dashboard?notice=Discord+account+linked+successfully');
  } catch (err) {
    logger.error('Error during Discord account linking callback', err, 'AUTH');
    return res.redirect('/dashboard?error=discord_link_failed');
  }
});

module.exports = router;
