/**
 * Custom Visual Rank Card Generator using @napi-rs/canvas
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getLevelProgress } = require('../../shared/utils/helpers');

async function generateRankCard(user, member, userLevelData, rankPosition = 1) {
  const width = 850;
  const height = 260;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const { level, currentLevelXp, nextLevelXp, progressXp, neededXp, percentage } = getLevelProgress(userLevelData.xp || 0);

  // Helper for rounded rectangle
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

  // 1. Draw Card Background
  roundRect(0, 0, width, height, 20);
  ctx.clip();

  // Dark background gradient (#0B0E14 to #131823)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0B0E14');
  bgGrad.addColorStop(1, '#131823');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Blurple accent ambient glow on top right
  const glowGrad = ctx.createRadialGradient(width - 50, 50, 10, width - 50, 50, 300);
  glowGrad.addColorStop(0, 'rgba(88, 101, 242, 0.25)');
  glowGrad.addColorStop(1, 'rgba(19, 24, 35, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Border stroke
  ctx.strokeStyle = '#1E2538';
  ctx.lineWidth = 3;
  roundRect(2, 2, width - 4, height - 4, 20);
  ctx.stroke();

  // 2. Draw Avatar with Circular Mask
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
  } catch (err) {
    // Fallback if avatar fails to load
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
  }
  ctx.restore();

  // Avatar Border Ring
  ctx.beginPath();
  ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#5865F2';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 3. User Name & Discriminator
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px sans-serif';
  const name = user.username.length > 14 ? user.username.substring(0, 14) + '...' : user.username;
  ctx.fillText(name, 190, 85);

  ctx.fillStyle = '#8B949E';
  ctx.font = '20px sans-serif';
  const tag = user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : '';
  const nameWidth = ctx.measureText(name).width;
  ctx.fillText(tag, 195 + nameWidth, 85);

  // 4. Rank & Level Badges (Top Right)
  const rankText = `#${rankPosition}`;
  ctx.fillStyle = '#8B949E';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('RANK', width - 260, 85);

  ctx.fillStyle = '#5865F2';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(rankText, width - 200, 85);

  ctx.fillStyle = '#8B949E';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('LEVEL', width - 110, 85);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`${level}`, width - 40, 85);

  // 5. XP Text Info (above progress bar)
  ctx.fillStyle = '#8B949E';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(progressXp).toLocaleString()} / ${Math.floor(neededXp).toLocaleString()} XP (${percentage}%)`, width - 45, 160);
  ctx.textAlign = 'left';

  // 6. XP Progress Bar
  const barX = 190;
  const barY = 175;
  const barW = width - barX - 45;
  const barH = 26;
  const barRadius = 13;

  // Background track
  roundRect(barX, barY, barW, barH, barRadius);
  ctx.fillStyle = '#1A2030';
  ctx.fill();

  // Progress fill
  const fillW = Math.max(barRadius * 2, (barW * percentage) / 100);
  if (percentage > 0) {
    roundRect(barX, barY, fillW, barH, barRadius);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
    barGrad.addColorStop(0, '#5865F2');
    barGrad.addColorStop(1, '#7983F5');
    ctx.fillStyle = barGrad;
    ctx.fill();
  }

  // 7. Subtle Footer Info
  ctx.fillStyle = '#6E7681';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Messages: ${(userLevelData.messages || 0).toLocaleString()} • Voice: ${(userLevelData.voiceMinutes || 0).toLocaleString()} mins`, 190, 225);

  return canvas.toBuffer('image/png');
}

module.exports = { generateRankCard };
