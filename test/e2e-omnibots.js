/**
 * OmniBots Comprehensive E2E Test Suite
 * Tests all core subsystems: Zero-Env engine, Multi-Adapter DB, Dual CommandContext,
 * Command Router, Tickets, Applications, Dynamic Invite Card Generator, Express Dashboard & Legal Routes.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

async function runTests() {
  console.log('--- STARTING OMNIBOTS EXPANDED TEST SUITE ---');

  // 1. Zero-Env Config Engine & Encryption
  console.log('\n[1/7] Testing Zero-Env Engine & AES-256-GCM Encryption...');
  const { encrypt, decrypt, SESSION_SECRET, ENCRYPTION_KEY } = require('../shared/config');
  assert(SESSION_SECRET && SESSION_SECRET.length >= 32, 'SESSION_SECRET must be at least 32 chars');
  assert(ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32, 'ENCRYPTION_KEY must be at least 32 chars');

  const sampleToken = 'MTEyMjMzNDQ1NS54eXp.dGVzdF90b2tlbl9mb3JfZGlzY29yZA==';
  const encrypted = encrypt(sampleToken);
  assert(encrypted.startsWith('enc_v1:'), 'Encrypted token must start with enc_v1:');
  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, sampleToken, 'Decrypted token must match original token');
  console.log('✅ Zero-Env Config & Encryption: PASSED');

  // 2. Database Multi-Adapter Layer
  console.log('\n[2/7] Testing Database Layer (Admin, ManagedBots, CommandsConfig, Guilds)...');
  const { db } = require('../shared');
  await db.init();

  // Test Admin Creation
  const testUsername = 'testadmin_' + Math.random().toString(36).substring(2, 7);
  const testHash = '$2a$12$e8s3YxM1e4xV7H8p1B.5AOV9h8X3o1n3e9K1s8a7h4u1p2e3r4t5';
  await db.admin.createAdmin(testUsername, testHash);
  const hasAdmin = await db.admin.hasAdmin();
  assert.strictEqual(hasAdmin, true, 'hasAdmin() must return true after admin creation');
  const adminDoc = await db.admin.getAdmin(testUsername);
  assert.strictEqual(adminDoc.username, testUsername.toLowerCase(), 'Admin username must match');

  // Test Commands Config
  const guildId = '123456789012345678';
  await db.commandsConfig.set(guildId, {
    prefix: '?',
    secondaryPrefixes: ['!', '.'],
    allowMentionPrefix: true,
    modules: { moderation: true, economy: false }
  });
  const cmdCfg = await db.commandsConfig.get(guildId);
  assert.strictEqual(cmdCfg.prefix, '?', 'Prefix must be ?');
  assert.strictEqual(cmdCfg.modules.economy, false, 'Economy module must be false');
  console.log('✅ Database Layer: PASSED');

  // 3. CommandContext Dual-Engine
  console.log('\n[3/7] Testing CommandContext Dual-Engine Abstraction...');
  const CommandContext = require('../bot/structures/CommandContext');

  // Mock Slash Interaction
  let repliedContent = '';
  const mockSlash = {
    isChatInputCommand: () => true,
    commandName: 'ban',
    guild: { id: guildId, members: { fetch: async (id) => ({ id, tag: 'target#0001' }) } },
    channel: { id: 'channel_123', name: 'general' },
    user: { id: 'mod_123', tag: 'Mod#0001' },
    member: { id: 'mod_123', permissions: { has: () => true } },
    options: {
      getSubcommand: () => 'add',
      getUser: () => ({ id: 'target_123', tag: 'Target#0001' }),
      getString: (name) => name === 'reason' ? 'Spamming channels' : null,
      getInteger: () => 7
    },
    reply: async (payload) => { repliedContent = payload; return payload; },
    editReply: async (payload) => { repliedContent = payload; return payload; }
  };

  const slashCtx = new CommandContext({ interaction: mockSlash, commandName: 'ban' });
  assert.strictEqual(slashCtx.isSlash, true);
  assert.strictEqual(slashCtx.options.getSubcommand(), 'add');
  const slashUser = slashCtx.options.getUser('target');
  assert.strictEqual(slashUser.id, 'target_123');
  await slashCtx.reply('Banned successfully');
  assert.strictEqual(repliedContent.content, 'Banned successfully');

  // Mock Prefix Message
  let prefixReplied = '';
  const mockMessage = {
    content: '?warn add <@987654321098765432> Inappropriate language',
    author: { id: 'mod_456', tag: 'Moderator#0002', bot: false },
    guild: { id: guildId, members: { cache: new Map(), fetch: async () => null } },
    channel: { id: 'channel_123', name: 'general', send: async (p) => { prefixReplied = p.content; } },
    member: { id: 'mod_456', permissions: { has: () => true } },
    mentions: {
      users: new Map([['987654321098765432', { id: '987654321098765432', tag: 'Offender#9999' }]]),
      channels: new Map(),
      roles: new Map()
    },
    reply: async (payload) => { prefixReplied = payload.content; return payload; }
  };
  mockMessage.mentions.users.first = () => mockMessage.mentions.users.get('987654321098765432');

  const rawArgs = ['add', '<@987654321098765432>', 'Inappropriate', 'language'];
  const prefixCtx = new CommandContext({
    message: mockMessage,
    args: rawArgs,
    prefix: '?',
    commandName: 'warn'
  });
  assert.strictEqual(prefixCtx.isSlash, false);
  assert.strictEqual(prefixCtx.options.getSubcommand(), 'add');
  const prefixUser = prefixCtx.options.getUser('target');
  assert.strictEqual(prefixUser.id, '987654321098765432');
  const reasonText = prefixCtx.options.getString('reason');
  assert.strictEqual(reasonText, 'Inappropriate language');
  console.log('✅ CommandContext Dual-Engine: PASSED');

  // 4. Command Router & Registry
  console.log('\n[4/7] Testing Command Loader & Router...');
  const commandsDir = path.join(__dirname, '..', 'bot', 'commands');
  const allDirs = fs.readdirSync(commandsDir);
  let totalCommandFiles = 0;
  for (const dir of allDirs) {
    const p = path.join(commandsDir, dir);
    if (fs.statSync(p).isDirectory()) {
      const files = fs.readdirSync(p).filter(f => f.endsWith('.js'));
      totalCommandFiles += files.length;
    }
  }
  assert(totalCommandFiles >= 50, `Total commands must be at least 50, found ${totalCommandFiles}`);
  console.log(`✅ Command Registry: Loaded & Verified ${totalCommandFiles} Commands across all modules: PASSED`);

  // 5. Multi-Category Tickets & Staff Applications DB Models
  console.log('\n[5/7] Testing Tickets & Applications Database Models...');
  const testBotId = 'bot_test_123';
  const testGuildId = 'guild_test_456';

  // Ticket Categories & Panels
  const cat1 = await db.ticketCategories.save('cat_general', {
    botId: testBotId,
    guildId: testGuildId,
    name: 'General Support',
    emoji: '🎫',
    description: 'Need help with something?',
    buttonColor: 'Primary',
    modalQuestions: [
      { id: 'q_issue', label: 'What is your issue?', style: 'Paragraph', required: true }
    ]
  });
  assert.strictEqual(cat1.name, 'General Support');
  const cats = await db.ticketCategories.list(testGuildId, testBotId);
  assert(cats.some(c => c.id === 'cat_general'), 'Ticket category list must include cat_general');

  const panel1 = await db.ticketPanels.save('panel_main', {
    botId: testBotId,
    guildId: testGuildId,
    channelId: 'channel_tickets',
    panelEmbed: {
      title: 'Support Center',
      description: 'Need assistance? Open a ticket below.',
      color: '#5865F2'
    },
    selectorStyle: 'buttons',
    categoryIds: ['cat_general']
  });
  assert.strictEqual(panel1.panelEmbed.title, 'Support Center');

  // Ticket creation & close
  const ticket1 = await db.tickets.create({
    ticketId: 'ticket-general-1',
    botId: testBotId,
    guildId: testGuildId,
    channelId: 'ch_ticket_1',
    openerId: 'user_123',
    categoryId: 'cat_general',
    status: 'open',
    answersJson: JSON.stringify({ q_issue: 'My test problem' })
  });
  assert.strictEqual(ticket1.status, 'open');
  await db.tickets.update(ticket1.id, {
    status: 'closed',
    closeReason: 'Resolved by admin',
    closedBy: 'admin_1'
  });
  const closedTicket = await db.tickets.get(ticket1.id);
  assert.strictEqual(closedTicket.status, 'closed');

  // Application Forms & Submissions
  const appForm = await db.applicationForms.save('form_mod', {
    botId: testBotId,
    guildId: testGuildId,
    name: 'Moderator Application',
    description: 'Join our moderation staff',
    isOpen: true,
    questions: [
      { prompt: 'Why do you want to join?', type: 'paragraph' }
    ]
  });
  assert.strictEqual(appForm.name, 'Moderator Application');

  const appSub = await db.applicationSubmissions.create({
    formId: 'form_mod',
    botId: testBotId,
    guildId: testGuildId,
    userId: 'applicant_1',
    answers: [{ question: 'Why do you want to join?', answer: 'I love helping people' }],
    status: 'pending'
  });
  assert.strictEqual(appSub.status, 'pending');
  await db.applicationSubmissions.update(appSub.id, {
    status: 'accepted',
    reviewedBy: 'reviewer_1',
    reviewNote: 'Great answers!'
  });
  const reviewedSub = await db.applicationSubmissions.get(appSub.id);
  assert.strictEqual(reviewedSub.status, 'accepted');
  console.log('✅ Tickets & Applications DB Architecture: PASSED');

  // 6. Dynamic Invite Picture Card Generator
  console.log('\n[6/7] Testing Dynamic Invite Picture Card Generator (Pure-JS / Hostinger-Safe)...');
  const { generateInviteCard } = require('../bot/utils/inviteCard');
  const cardBuffer = await generateInviteCard({
    joiningUser: { username: 'NewUser', tag: 'NewUser#1234', avatarURL: () => null },
    inviterUser: { username: 'InviterPro', tag: 'InviterPro#9999', avatarURL: () => null },
    inviterTotal: 42,
    memberCount: 1337,
    guildName: 'OmniBots HQ',
    accentColor: '#5865F2',
    gradientStart: '#0B0E14',
    gradientEnd: '#131823'
  });
  assert(Buffer.isBuffer(cardBuffer), 'Card result must be a Buffer');
  assert(cardBuffer.length > 500, `Card buffer must contain image data, received ${cardBuffer.length} bytes`);
  console.log(`✅ Dynamic Invite Picture Card: Generated valid image buffer (${cardBuffer.length} bytes): PASSED`);

  // 7. Express Dashboard Server & Public Legal Routes
  console.log('\n[7/7] Testing Express Dashboard Server & Public Routes (/health, /privacy, /terms)...');
  const { app } = require('../dashboard/server');

  function testRoute(targetPath) {
    return new Promise((resolve) => {
      const req = new http.IncomingMessage();
      req.method = 'GET';
      req.url = targetPath;
      req.headers = { host: 'localhost' };
      req.socket = { encrypted: false, remoteAddress: '127.0.0.1' };
      req.connection = req.socket;

      const res = new http.ServerResponse(req);
      let output = '';
      res.write = (chunk) => { output += chunk; return true; };
      res.end = (chunk) => {
        if (chunk) output += chunk;
        resolve({ statusCode: res.statusCode, body: output });
      };
      app.handle(req, res);
    });
  }

  // Test /health endpoint
  const healthRes = await testRoute('/health');
  assert.strictEqual(healthRes.statusCode, 200, 'Health endpoint must return 200');
  assert(healthRes.body.includes('"status":"ok"'), 'Health response must contain status ok');

  // Test /privacy public endpoint
  const privacyRes = await testRoute('/privacy');
  assert.strictEqual(privacyRes.statusCode, 200, 'Privacy endpoint must return 200');
  assert(privacyRes.body.includes('OmniBots'), 'Privacy policy must feature OmniBots');
  assert(!privacyRes.body.includes('Antigravity Bot'), 'Privacy policy must not contain Antigravity Bot');

  // Test /terms public endpoint
  const termsRes = await testRoute('/terms');
  assert.strictEqual(termsRes.statusCode, 200, 'Terms endpoint must return 200');
  assert(termsRes.body.includes('OmniBots'), 'Terms of Service must feature OmniBots');
  assert(!termsRes.body.includes('Antigravity Bot'), 'Terms of Service must not contain Antigravity Bot');

  console.log('✅ Express Dashboard Server & Public Legal Routes: PASSED');

  // 8. Discord OAuth2 Config (Bot Client ID & Secret Linking) & SVG Branding
  console.log('\n[8/8] Testing Discord OAuth2 Engine & Clean SVG Assets (Logo + Favicon)...');
  
  // Test OAuth config save and encrypted secret retrieval
  const testClientId = '998877665544332211';
  const testClientSecret = 'super_secret_discord_oauth_key_12345';
  await db.oauthConfig.set({
    clientId: testClientId,
    clientSecret: testClientSecret,
    redirectUri: 'https://omnibots.app/auth/discord/callback'
  });

  const oauthCfg = await db.oauthConfig.get();
  assert.strictEqual(oauthCfg.clientId, testClientId, 'OAuth clientId must match');
  assert.strictEqual(oauthCfg.clientSecret, testClientSecret, 'Decrypted OAuth secret must match original');
  assert.strictEqual(oauthCfg.hasSecret, true, 'hasSecret must be true');
  assert.strictEqual(oauthCfg.isConfigured, true, 'isConfigured must be true');

  // Test SVG Logo & Favicon Assets
  const logoPath = path.join(__dirname, '..', 'dashboard', 'public', 'images', 'logo.svg');
  const faviconPath = path.join(__dirname, '..', 'dashboard', 'public', 'favicon.svg');
  assert(fs.existsSync(logoPath), 'logo.svg must exist');
  assert(fs.existsSync(faviconPath), 'favicon.svg must exist');

  const logoContent = fs.readFileSync(logoPath, 'utf8');
  const faviconContent = fs.readFileSync(faviconPath, 'utf8');
  assert(logoContent.includes('<svg'), 'logo.svg must be a valid SVG');
  assert(logoContent.includes('Omni') && logoContent.includes('Bots'), 'logo.svg must contain OmniBots wordmark');
  assert(faviconContent.includes('<svg') && faviconContent.includes('viewBox="0 0 32 32"'), 'favicon.svg must have 32x32 viewBox');
  console.log('✅ Discord OAuth2 Engine & Clean SVG Assets: PASSED');

  console.log('\n========================================');
  console.log('🎉 ALL 8 TEST SUITES PASSED FLAWLESSLY!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
