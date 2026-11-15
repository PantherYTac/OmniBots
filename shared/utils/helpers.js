/**
 * Shared Helper Utilities for Discord Bot & Dashboard
 */

/**
 * Truncate a string to a specific length with ellipsis
 */
function truncate(str, max = 1000) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 3) + '...' : str;
}

/**
 * Parse human duration string (e.g. "10m", "2h", "1d", "7d") into milliseconds
 */
function parseDuration(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const match = str.trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|w)?$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2] || 'm';

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000;
  }
}

/**
 * Format milliseconds into human readable duration
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Calculate Level from total XP
 * Formula: Level = Math.floor(0.1 * Math.sqrt(xp))
 */
function getLevel(xp = 0) {
  return Math.floor(0.1 * Math.sqrt(Math.max(0, xp)));
}

/**
 * Calculate required XP for a given level
 */
function getXpForLevel(level = 0) {
  return Math.pow(level / 0.1, 2);
}

/**
 * Calculate progress to next level
 */
function getLevelProgress(xp = 0) {
  const currentLevel = getLevel(xp);
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const neededXp = nextLevelXp - currentLevelXp;
  const progressXp = xp - currentLevelXp;
  const percentage = Math.min(100, Math.max(0, Math.round((progressXp / neededXp) * 100)));

  return {
    level: currentLevel,
    currentLevelXp,
    nextLevelXp,
    progressXp,
    neededXp,
    percentage
  };
}

/**
 * Simple diff comparison for message edit audit logging
 */
function computeDiff(oldText = '', newText = '') {
  if (oldText === newText) return 'No visible text differences';
  return `**Old:**\n${truncate(oldText, 500)}\n\n**New:**\n${truncate(newText, 500)}`;
}

/**
 * Parse permissions bitfield to check for Manage Server (0x20) or Administrator (0x8)
 */
function hasManageGuild(permissions) {
  if (!permissions) return false;
  const permBigInt = BigInt(permissions);
  const ADMIN = BigInt(0x8);
  const MANAGE_GUILD = BigInt(0x20);
  return (permBigInt & ADMIN) === ADMIN || (permBigInt & MANAGE_GUILD) === MANAGE_GUILD;
}

module.exports = {
  truncate,
  parseDuration,
  formatDuration,
  getLevel,
  getXpForLevel,
  getLevelProgress,
  computeDiff,
  hasManageGuild
};
