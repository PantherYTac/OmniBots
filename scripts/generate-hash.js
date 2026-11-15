#!/usr/bin/env node

/**
 * CLI Helper: Generate bcrypt password hash (SALT_ROUNDS = 12)
 * Designed for Hostinger Environment Variables configuration.
 *
 * Usage:
 *   npm run generate-hash
 *   npm run generate-hash "your_strong_password"
 */

const readline = require('readline');

async function getBcrypt() {
  try {
    return require('bcryptjs');
  } catch (err) {
    console.error('\n❌ Error: "bcryptjs" package is required.');
    console.error('Please run "npm install" first.\n');
    process.exit(1);
  }
}

async function processPassword(password) {
  const bcrypt = await getBcrypt();
  const byteLength = Buffer.byteLength(password, 'utf8');

  // Enforce safe input validation (block inputs over 72 bytes to avoid bcrypt truncation)
  if (byteLength > 72) {
    console.error(`\n❌ Error: Password exceeds bcrypt's 72-byte limit (${byteLength} bytes).`);
    console.error('Please choose a password of 72 bytes or fewer to prevent truncation edge cases.\n');
    process.exit(1);
  }

  if (password.length < 8) {
    console.warn('\n⚠️  Notice: Password is fewer than 8 characters. We recommend a strong password (12+ chars).\n');
  }

  const SALT_ROUNDS = 12;
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  console.log('\n==================================================================');
  console.log('🔐 SECURE BCRYPT PASSWORD HASH (SALT_ROUNDS = 12)');
  console.log('==================================================================\n');
  console.log(hash);
  console.log('\n==================================================================');
  console.log('📋 Next Steps for Hostinger Deployment:');
  console.log('1. Open Hostinger hPanel -> Websites -> Node.js App.');
  console.log('2. In Environment Variables, add or update:');
  console.log('   ADMIN_USERNAME=admin');
  console.log(`   ADMIN_PASSWORD_HASH=${hash}`);
  console.log('3. Remove or leave ADMIN_PASSWORD blank in production.');
  console.log('4. Restart your Node.js application.');
  console.log('==================================================================\n');
}

const inputArg = process.argv[2];
if (inputArg) {
  processPassword(inputArg);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter Master Admin Password to hash: ', (answer) => {
    rl.close();
    if (!answer || answer.trim().length === 0) {
      console.error('\n❌ Password cannot be empty.\n');
      process.exit(1);
    }
    processPassword(answer.trim());
  });
}
