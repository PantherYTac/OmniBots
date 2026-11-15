/**
 * Visual Rank Card Generator with Zero-Compile Pure SVG Fallback
 * Works cleanly on all environments (Hostinger shared hosting, Linux VPS, Pterodactyl, Docker, Windows, Mac)
 */

const { getLevelProgress } = require('../../shared/utils/helpers');

let canvasLib = null;
try {
  canvasLib = require('@napi-rs/canvas');
} catch {
  // @napi-rs/canvas not available; fallback to pure SVG generator
}

/**
 * Pure SVG Rank Card Generator (Zero-Dependency, 100% Host-Safe)
 */
function generateSvgRankCard(user, userLevelData, rankPosition = 1) {
  const width = 850;
  const height = 260;
  const { level, progressXp, neededXp, percentage } = getLevelProgress(userLevelData.xp || 0);

  const cleanName = (user.username || 'User').replace(/[<>&"']/g, '');
  const tag = user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : '';
  const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : 'https://cdn.discordapp.com/embed/avatars/0.png';

  const barX = 190;
  const barY = 175;
  const barW = width - barX - 45; // 615
  const barH = 26;
  const fillW = Math.max(26, Math.min(barW, Math.round((barW * percentage) / 100)));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0E14" />
      <stop offset="100%" stop-color="#131823" />
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5865F2" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>
    <radialGradient id="glowGrad" cx="90%" cy="15%" r="60%">
      <stop offset="0%" stop-color="rgba(88, 101, 242, 0.3)" />
      <stop offset="100%" stop-color="rgba(19, 24, 35, 0)" />
    </radialGradient>
    <clipPath id="avatarClip">
      <circle cx="100" cy="100" r="60" />
    </clipPath>
  </defs>

  <!-- Background Card -->
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="20" fill="url(#bgGrad)" stroke="#1E2538" stroke-width="3" />
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="20" fill="url(#glowGrad)" />

  <!-- Avatar -->
  <g>
    <image href="${avatarUrl}" x="40" y="40" width="120" height="120" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
    <circle cx="100" cy="100" r="60" fill="none" stroke="#5865F2" stroke-width="4" />
  </g>

  <!-- User Identity -->
  <text x="190" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="28" fill="#FFFFFF">${cleanName}</text>
  <text x="${195 + cleanName.length * 15}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" fill="#8B949E">${tag}</text>

  <!-- Rank and Level -->
  <text x="${width - 240}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="16" fill="#8B949E">RANK</text>
  <text x="${width - 185}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="28" fill="#38BDF8">#${rankPosition}</text>
  <text x="${width - 110}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="16" fill="#8B949E">LEVEL</text>
  <text x="${width - 50}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="28" fill="#5865F2">${level}</text>

  <!-- XP Progress Text -->
  <text x="${width - 45}" y="158" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="bold" font-size="14" fill="#8B949E" text-anchor="end">${Math.floor(progressXp).toLocaleString()} / ${Math.floor(neededXp).toLocaleString()} XP (${percentage}%)</text>

  <!-- Progress Bar Track -->
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="13" fill="#1A2030" />
  <!-- Progress Bar Fill -->
  <rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" rx="13" fill="url(#barGrad)" />

  <!-- Footer Stats -->
  <text x="190" y="228" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" fill="#6E7681">Messages: ${(userLevelData.messages || 0).toLocaleString()} • Voice: ${(userLevelData.voiceMinutes || 0).toLocaleString()} mins</text>
</svg>`;

  return Buffer.from(svg, 'utf8');
}

/**
 * Universal Card Generator: Attempts Canvas first, falls back to SVG
 */
async function generateRankCard(user, member, userLevelData, rankPosition = 1) {
  if (canvasLib && typeof canvasLib.createCanvas === 'function') {
    try {
      const { createCanvas, loadImage } = canvasLib;
      const width = 850;
      const height = 260;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const { level, progressXp, neededXp, percentage } = getLevelProgress(userLevelData.xp || 0);

      function roundRect(x, y, w, h, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }

      roundRect(0, 0, width, height, 20);
      ctx.clip();

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0B0E14');
      bgGrad.addColorStop(1, '#131823');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#1E2538';
      ctx.lineWidth = 3;
      roundRect(2, 2, width - 4, height - 4, 20);
      ctx.stroke();

      const avatarX = 40;
      const avatarY = 40;
      const avatarRadius = 60;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      try {
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImg = await loadImage(avatarUrl);
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
      } catch {
        ctx.fillStyle = '#5865F2';
        ctx.fillRect(avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#5865F2';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      const name = user.username.length > 14 ? user.username.substring(0, 14) + '...' : user.username;
      ctx.fillText(name, 190, 85);

      ctx.fillStyle = '#8B949E';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('RANK', width - 240, 85);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`#${rankPosition}`, width - 185, 85);

      ctx.fillStyle = '#8B949E';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('LEVEL', width - 110, 85);

      ctx.fillStyle = '#5865F2';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${level}`, width - 50, 85);

      ctx.fillStyle = '#8B949E';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(progressXp).toLocaleString()} / ${Math.floor(neededXp).toLocaleString()} XP (${percentage}%)`, width - 45, 158);
      ctx.textAlign = 'left';

      const barX = 190;
      const barY = 175;
      const barW = width - barX - 45;
      const barH = 26;

      roundRect(barX, barY, barW, barH, 13);
      ctx.fillStyle = '#1A2030';
      ctx.fill();

      const fillW = Math.max(26, (barW * percentage) / 100);
      if (percentage > 0) {
        roundRect(barX, barY, fillW, barH, 13);
        const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
        barGrad.addColorStop(0, '#5865F2');
        barGrad.addColorStop(1, '#38BDF8');
        ctx.fillStyle = barGrad;
        ctx.fill();
      }

      ctx.fillStyle = '#6E7681';
      ctx.font = '13px sans-serif';
      ctx.fillText(`Messages: ${(userLevelData.messages || 0).toLocaleString()} • Voice: ${(userLevelData.voiceMinutes || 0).toLocaleString()} mins`, 190, 228);

      return canvas.toBuffer('image/png');
    } catch (err) {
      // Fallback to SVG on any canvas rendering exception
    }
  }

  // Pure SVG fallback
  return generateSvgRankCard(user, userLevelData, rankPosition);
}

module.exports = {
  generateRankCard,
  generateSvgRankCard
};