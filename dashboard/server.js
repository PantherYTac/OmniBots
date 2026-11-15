/**
 * Hostinger Web App Node.js Entrypoint
 * Express.js Server + EJS View Engine + Master Admin Access Control
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { db } = require('../shared');
const config = require('../shared/config');
const logger = require('../shared/utils/logger');
const { initAdminCredentials } = require('./middleware/auth');
const DatabaseSessionStore = require('./middleware/sessionStore');

// Express App Initialization
const app = express();

// Trust reverse proxy for Hostinger, Nginx, Cloudflare & all SSL proxies
app.set('trust proxy', 1);

// Immediate Lightweight Healthcheck (Zero Middleware / Zero Database dependency)
// Responds instantly so host healthcheckers (Hostinger, Render, Railway, Koyeb) never mark app down
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// View Engine Setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Persistent Database Session Store Setup
// Persists sessions across Hostinger container restarts without memory leaks
const sessionStore = new DatabaseSessionStore();

app.use(session({
  store: sessionStore,
  name: 'omnibots_admin_sid',
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true, // Mitigate XSS cookie theft
    sameSite: 'lax', // Mitigate CSRF
    secure: 'auto' // Seamlessly adapts to HTTPS proxies and local HTTP without login redirect loops
  }
}));

// Global Template Locals
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.isAdmin = req.session?.isAdmin === true;
  res.locals.currentPath = req.path;
  next();
});

// Mount Routes
app.use('/', require('./routes/auth'));      // /login, /logout, /auth/discord
app.use('/', require('./routes/index'));     // /, /servers, /health, /leaderboard, /transcript
app.use('/dashboard', require('./routes/servers'));
app.use('/dashboard', require('./routes/manage'));
app.use('/api', require('./routes/api'));

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    status: 404,
    message: 'Page not found. The requested dashboard route does not exist.',
    user: req.session?.user || { username: 'Administrator' }
  });
});

// 500 Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Dashboard Server Error', err, 'EXPRESS');
  res.status(500).render('error', {
    status: 500,
    message: 'An unexpected internal error occurred on the dashboard server.',
    user: req.session?.user || { username: 'Administrator' }
  });
});

// Global Process Crash-Guards: Prevent unhandled Discord API / Gateway errors from crashing web app
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection safely trapped:', reason, 'CRASH_GUARD');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception safely trapped:', err, 'CRASH_GUARD');
});

// Server Starter
async function startDashboard() {
  try {
    const PORT = parseInt(process.env.PORT, 10) || 3000;
    const HOST = '0.0.0.0'; // Essential for Hostinger reverse proxy routing

    // 1. Start Express HTTP Server FIRST so the website is immediately accessible
    const server = app.listen(PORT, HOST, () => {
      logger.success(`OmniBots Web Dashboard online and listening on ${HOST}:${PORT}`, 'HOSTINGER_DASHBOARD');
      logger.info(`Master Admin Login Gate active at http://${HOST}:${PORT}/login`, 'HOSTINGER_DASHBOARD');
      logger.info(`Hostinger Entrypoint: dashboard/server.js ready`, 'HOSTINGER_DASHBOARD');
    });

    // 2. Initialize Database & Bot Fleet asynchronously in the background
    (async () => {
      try {
        await db.init();
        initAdminCredentials();
        logger.success('Shared database and Master Admin initialized.', 'STARTUP');
      } catch (dbErr) {
        logger.error('Non-fatal error during database initialization:', dbErr, 'STARTUP');
      }

      try {
        const { botManager } = require('../bot/BotManager');
        await botManager.init();
        logger.success('BotManager fleet initialization completed.', 'STARTUP');
      } catch (botErr) {
        logger.error('Non-fatal error during BotManager fleet initialization:', botErr, 'STARTUP');
      }
    })();

    return server;
  } catch (err) {
    logger.error('Failed to bind Dashboard server port', err, 'HOSTINGER_DASHBOARD');
    throw err;
  }
}

// Auto-start if executed directly (e.g. node dashboard/server.js)
if (require.main === module) {
  startDashboard();
}

module.exports = { app, startDashboard };
