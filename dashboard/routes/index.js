/**
 * Core Navigation & Protected Public Routes
 */

const express = require('express');
const router = express.Router();
const { db } = require('../../shared');
const { getLevelProgress } = require('../../shared/utils/helpers');
const { getGuildDetails } = require('../middleware/botClient');
const { requireAdminAuth } = require('../middleware/auth');

// Root Route: Redirects to /setup if not configured, /dashboard if logged in, otherwise /login gate
router.get('/', async (req, res) => {
  const hasAdmin = await db.admin.hasAdmin();
  if (!hasAdmin) {
    return res.redirect('/setup');
  }
  if (req.session && req.session.isAdmin === true) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

// /servers alias -> /dashboard
router.get('/servers', requireAdminAuth, (req, res) => {
  return res.redirect('/dashboard');
});

// Unauthenticated Healthcheck Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Public Legal Endpoints (Discord Verification-Compliant, bypasses requireAdminAuth)
router.get('/privacy', async (req, res) => {
  const legalDocs = await db.legalDocuments.get();
  const contactEmail = legalDocs.contactEmail || 'support@yourdomain.com';
  const supportServer = legalDocs.supportServerInvite || 'https://discord.gg/yourserver';
  const content = (legalDocs.privacyPolicy?.content || '')
    .replace(/\{\{CONTACT_EMAIL\}\}/g, contactEmail)
    .replace(/\{\{SUPPORT_SERVER\}\}/g, supportServer);

  res.render('legal', {
    type: 'privacy',
    title: 'Privacy Policy',
    content,
    updatedAt: legalDocs.privacyPolicy?.updatedAt || legalDocs.updatedAt,
    contactEmail,
    supportServer,
    user: req.session?.user || null
  });
});

router.get('/terms', async (req, res) => {
  const legalDocs = await db.legalDocuments.get();
  const contactEmail = legalDocs.contactEmail || 'support@yourdomain.com';
  const supportServer = legalDocs.supportServerInvite || 'https://discord.gg/yourserver';
  const content = (legalDocs.termsOfService?.content || '')
    .replace(/\{\{CONTACT_EMAIL\}\}/g, contactEmail)
    .replace(/\{\{SUPPORT_SERVER\}\}/g, supportServer);

  res.render('legal', {
    type: 'terms',
    title: 'Terms of Service',
    content,
    updatedAt: legalDocs.termsOfService?.updatedAt || legalDocs.updatedAt,
    contactEmail,
    supportServer,
    user: req.session?.user || null
  });
});

// Server Leaderboard (Toggleable via PUBLIC_LEADERBOARD in .env, defaults to false)
router.get('/leaderboard/:guildId', async (req, res, next) => {
  const isPublic = process.env.PUBLIC_LEADERBOARD === 'true';

  // If public leaderboard is disabled (default), lock behind master admin authentication
  if (!isPublic && (!req.session || req.session.isAdmin !== true)) {
    return requireAdminAuth(req, res, next);
  }

  const guildId = req.params.guildId;
  const rawLeaderboard = await db.levels.getLeaderboard(guildId, 50);
  const guild = await getGuildDetails(guildId);

  const leaderboard = rawLeaderboard.map((u, idx) => ({
    userId: u.userId,
    username: u.userName || `Member #${idx + 1}`,
    avatar: u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png',
    level: u.level || 0,
    xp: u.xp || 0,
    messages: u.messages || 0
  }));

  res.render('public-leaderboard', {
    user: req.session.user || { username: 'Guest' },
    guild: guild || { id: guildId, name: 'Discord Community' },
    leaderboard,
    getLevelProgress
  });
});

// Ticket HTML Transcript Viewer (Protected by requireAdminAuth)
router.get('/transcript/:ticketId', requireAdminAuth, async (req, res) => {
  const ticketId = req.params.ticketId;
  const ticket = await db.tickets.get(ticketId);

  if (!ticket || !ticket.transcriptHtml) {
    return res.status(404).render('transcript', { ticket: null });
  }

  return res.render('transcript', { ticket });
});

module.exports = router;
