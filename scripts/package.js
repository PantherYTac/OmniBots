/**
 * OmniBots Standalone Packaging Script
 * Generates ready-to-upload omnibots.zip and omnibots.tar.gz archives
 * for direct upload on Hostinger File Manager, cPanel, Plesk, and VPS.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('--- OmniBots Packaging Utility ---');

const zipName = 'omnibots.zip';
const tarName = 'omnibots.tar.gz';

const zipPath = path.join(rootDir, zipName);
const tarPath = path.join(rootDir, tarName);

// Clean existing archives if present
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);

// Items to include
const includeItems = [
  'bot',
  'dashboard',
  'shared',
  'test',
  'scripts',
  'package.json',
  'package-lock.json',
  'README.md',
  '.env.example',
  '.gitignore'
];

try {
  console.log('1. Building ZIP archive (omnibots.zip)...');
  execSync(
    `cd "${rootDir}" && zip -r -q "${zipName}" ${includeItems.join(' ')} -x "*/node_modules/*" "*.DS_Store*" "*store.json" "*config.json" "*.tmp*"`,
    { stdio: 'inherit' }
  );
  const zipStats = fs.statSync(zipPath);
  console.log(`   Created ${zipName}: ${(zipStats.size / 1024).toFixed(1)} KB`);

  console.log('2. Building TAR.GZ archive (omnibots.tar.gz)...');
  execSync(
    `cd "${rootDir}" && tar -czf "${tarName}" --exclude="node_modules" --exclude=".git" --exclude=".DS_Store" --exclude="shared/data/store.json" --exclude="data/config.json" --exclude="*.tmp" ${includeItems.join(' ')}`,
    { stdio: 'inherit' }
  );
  const tarStats = fs.statSync(tarPath);
  console.log(`   Created ${tarName}: ${(tarStats.size / 1024).toFixed(1)} KB`);

  console.log('\nPackaging complete! Archives are ready for direct deployment without git:');
  console.log(`- ${zipName} (recommended for Hostinger / cPanel File Manager)`);
  console.log(`- ${tarName} (recommended for Linux VPS / SSH / Docker)`);
} catch (err) {
  console.error('Packaging failed:', err.message);
  process.exit(1);
}
