/**
 * Dynamic Invite Banner Picture Card Generator
 * Hostinger-safe, zero-compile architecture with triple-redundancy:
 * 1. @napi-rs/canvas (high-performance pure-Node bindings when present)
 * 2. @resvg/resvg-js (high-fidelity SVG-to-PNG renderer when present)
 * 3. Pure-JS SVG buffer generator (100% host safe, zero native build dependencies)
 */

let canvasLib = null;
try {
  canvasLib = require('@napi-rs/canvas');
} catch {}

let resvgLib = null;
try {
  resvgLib = require('@resvg/resvg-js');
} catch {}

/**
 * Fetch avatar image as Base64 data URI
 */
async function getAvatarDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Pure SVG Invite Banner (900x300)
 */
async function generateSvgInviteCard({
  member,
  inviterUser,
  inviterRecord,
  code = 'N/A',
  memberCount = 1,
  accentColor = '#5865F2',
  gradientStart = '#0B0E14',
  gradientEnd = '#131823'
}) {
  const width = 900;
  const height = 300;

  const memberName = escapeXml(member?.user?.username || 'New Member');
  const memberTag = member?.user?.discriminator && member.user.discriminator !== '0'
    ? `#${member.user.discriminator}`
    : '';

  const memberAvatarUrl = member?.user?.displayAvatarURL
    ? member.user.displayAvatarURL({ extension: 'png', size: 256 })
    : null;
  const memberAvatarUri = (await getAvatarDataUri(memberAvatarUrl)) || 'https://cdn.discordapp.com/embed/avatars/0.png';

  const isVanity = code === 'VANITY' || (!inviterUser && code !== 'UNKNOWN');
  const inviterName = escapeXml(
    inviterUser ? inviterUser.username : (isVanity ? 'Vanity URL' : 'Direct / Unknown')
  );
  const inviterCount = inviterRecord?.total != null ? inviterRecord.total : (inviterRecord?.regular || 0);

  const inviterAvatarUrl = inviterUser?.displayAvatarURL
    ? inviterUser.displayAvatarURL({ extension: 'png', size: 256 })
    : null;
  const inviterAvatarUri = (await getAvatarDataUri(inviterAvatarUrl)) || 'https://cdn.discordapp.com/embed/avatars/1.png';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradientStart}" />
      <stop offset="100%" stop-color="${gradientEnd}" />
    </linearGradient>

    <!-- Glassmorphic Overlay Gradient -->
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(88, 101, 242, 0.12)" />
      <stop offset="50%" stop-color="rgba(56, 189, 248, 0.08)" />
      <stop offset="100%" stop-color="rgba(88, 101, 242, 0.12)" />
    </linearGradient>

    <!-- Center Glow Badge Gradient -->
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <!-- Pill Badge Gradient -->
    <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1E2538" />
      <stop offset="100%" stop-color="#283248" />
    </linearGradient>

    <!-- Avatar Clips -->
    <clipPath id="memberAvatarClip">
      <circle cx="130" cy="140" r="58" />
    </clipPath>
    <clipPath id="inviterAvatarClip">
      <circle cx="770" cy="140" r="58" />
    </clipPath>
  </defs>

  <!-- Background Base Container -->
  <rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="24" fill="url(#bgGrad)" stroke="#1E2538" stroke-width="2.5" />
  <rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="24" fill="url(#glassGrad)" />

  <!-- Corner Pill: Member Count -->
  <g>
    <rect x="${width - 190}" y="22" width="168" height="34" rx="17" fill="url(#pillGrad)" stroke="#2B354C" stroke-width="1.5" />
    <circle cx="${width - 173}" cy="39" r="5" fill="#38BDF8" />
    <text x="${width - 158}" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="13" fill="#DCDDDE">MEMBER #${memberCount}</text>
  </g>

  <!-- Top Server Welcome Header -->
  <text x="35" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="12" fill="${accentColor}" letter-spacing="1.5">SERVER INVITATION VERIFIED</text>

  <!-- LEFT: Joining Member -->
  <g>
    <!-- Outer Glow Ring -->
    <circle cx="130" cy="140" r="64" fill="none" stroke="${accentColor}" stroke-width="3" stroke-dasharray="6,4" opacity="0.6" />
    <!-- Avatar -->
    <image href="${memberAvatarUri}" x="72" y="82" width="116" height="116" clip-path="url(#memberAvatarClip)" preserveAspectRatio="xMidYMid slice" />
    <circle cx="130" cy="140" r="58" fill="none" stroke="${accentColor}" stroke-width="3.5" />

    <!-- Role Badge -->
    <rect x="65" y="212" width="130" height="24" rx="12" fill="url(#badgeGrad)" />
    <text x="130" y="228" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="11" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">NEW MEMBER</text>

    <!-- Member Name -->
    <text x="130" y="258" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="17" fill="#FFFFFF" text-anchor="middle">${memberName.length > 15 ? memberName.substring(0, 15) + '...' : memberName}</text>
    <text x="130" y="278" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#8B949E" text-anchor="middle">${memberTag}</text>
  </g>

  <!-- CENTER: Glowing Arrow Badge (INVITED BY) -->
  <g>
    <!-- Background Connecting Track -->
    <line x1="230" y1="140" x2="350" y2="140" stroke="#1E2538" stroke-width="3" stroke-dasharray="4,4" />
    <line x1="550" y1="140" x2="670" y2="140" stroke="#1E2538" stroke-width="3" stroke-dasharray="4,4" />

    <!-- Center Card -->
    <rect x="345" y="105" width="210" height="70" rx="20" fill="#131823" stroke="#2B354C" stroke-width="2" />
    <rect x="360" y="118" width="180" height="26" rx="13" fill="url(#badgeGrad)" />
    <text x="450" y="135" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="11" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">INVITED BY</text>

    <!-- Code Pill -->
    <text x="450" y="162" font-family="monospace, 'Courier New', sans-serif" font-weight="700" font-size="12" fill="#38BDF8" text-anchor="middle">code: ${escapeXml(code)}</text>
  </g>

  <!-- RIGHT: Inviter Profile -->
  <g>
    <!-- Outer Glow Ring -->
    <circle cx="770" cy="140" r="64" fill="none" stroke="#38BDF8" stroke-width="3" stroke-dasharray="6,4" opacity="0.6" />
    <!-- Avatar -->
    <image href="${inviterAvatarUri}" x="712" y="82" width="116" height="116" clip-path="url(#inviterAvatarClip)" preserveAspectRatio="xMidYMid slice" />
    <circle cx="770" cy="140" r="58" fill="none" stroke="#38BDF8" stroke-width="3.5" />

    <!-- Pill Badge: NOW HAS X INVITES -->
    <rect x="685" y="212" width="170" height="24" rx="12" fill="#1A2030" stroke="#2B354C" stroke-width="1.5" />
    <text x="770" y="228" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="11" fill="#38BDF8" text-anchor="middle">NOW HAS ${inviterCount} INVITES</text>

    <!-- Inviter Name -->
    <text x="770" y="258" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="17" fill="#FFFFFF" text-anchor="middle">${inviterName.length > 15 ? inviterName.substring(0, 15) + '...' : inviterName}</text>
    <text x="770" y="278" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#8B949E" text-anchor="middle">Referral Ambassador</text>
  </g>
</svg>`;

  return Buffer.from(svg, 'utf8');
}

/**
 * Universal Invite Banner Generator
 * Triple-fallback execution pipeline
 */
async function generateInviteCard(options) {
  // Option A: If @resvg/resvg-js is available, convert the high-res SVG directly to crisp PNG
  if (resvgLib && typeof resvgLib.Resvg === 'function') {
    try {
      const svgBuffer = await generateSvgInviteCard(options);
      const resvg = new resvgLib.Resvg(svgBuffer, {
        fitTo: { mode: 'width', value: 900 }
      });
      const pngData = resvg.render();
      return pngData.asPng();
    } catch {}
  }

  // Option B: If @napi-rs/canvas is present, render via Canvas 2D
  if (canvasLib && typeof canvasLib.createCanvas === 'function') {
    try {
      const { createCanvas, loadImage } = canvasLib;
      const width = 900;
      const height = 300;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const {
        member,
        inviterUser,
        inviterRecord,
        code = 'N/A',
        memberCount = 1,
        accentColor = '#5865F2',
        gradientStart = '#0B0E14',
        gradientEnd = '#131823'
      } = options;

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

      // Clip bounds
      roundRect(0, 0, width, height, 24);
      ctx.clip();

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, gradientStart);
      bgGrad.addColorStop(1, gradientEnd);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Glassmorphic border
      ctx.strokeStyle = '#1E2538';
      ctx.lineWidth = 3;
      roundRect(2, 2, width - 4, height - 4, 24);
      ctx.stroke();

      // Member Count Pill in top right
      roundRect(width - 190, 22, 168, 34, 17);
      ctx.fillStyle = '#1A2030';
      ctx.fill();
      ctx.strokeStyle = '#2B354C';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(width - 173, 39, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#DCDDDE';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`MEMBER #${memberCount}`, width - 158, 44);

      // Header Tagline
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('SERVER INVITATION VERIFIED', 35, 44);

      // LEFT: Joining Member Avatar
      const mAvatarX = 130;
      const mAvatarY = 140;
      const mRadius = 58;

      ctx.save();
      ctx.beginPath();
      ctx.arc(mAvatarX, mAvatarY, mRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      try {
        const mUrl = member?.user?.displayAvatarURL ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
        if (mUrl) {
          const mImg = await loadImage(mUrl);
          ctx.drawImage(mImg, mAvatarX - mRadius, mAvatarY - mRadius, mRadius * 2, mRadius * 2);
        } else {
          ctx.fillStyle = accentColor;
          ctx.fillRect(mAvatarX - mRadius, mAvatarY - mRadius, mRadius * 2, mRadius * 2);
        }
      } catch {
        ctx.fillStyle = accentColor;
        ctx.fillRect(mAvatarX - mRadius, mAvatarY - mRadius, mRadius * 2, mRadius * 2);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(mAvatarX, mAvatarY, mRadius, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Role Pill
      roundRect(65, 212, 130, 24, 12);
      const pillGrad = ctx.createLinearGradient(65, 212, 195, 212);
      pillGrad.addColorStop(0, accentColor);
      pillGrad.addColorStop(1, '#38BDF8');
      ctx.fillStyle = pillGrad;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEW MEMBER', 130, 228);

      const mName = member?.user?.username || 'New Member';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(mName.length > 15 ? mName.substring(0, 15) + '...' : mName, 130, 258);

      const mTag = member?.user?.discriminator && member.user.discriminator !== '0' ? `#${member.user.discriminator}` : '';
      ctx.fillStyle = '#8B949E';
      ctx.font = '12px sans-serif';
      ctx.fillText(mTag, 130, 278);

      // CENTER: INVITED BY
      roundRect(345, 105, 210, 70, 20);
      ctx.fillStyle = '#131823';
      ctx.fill();
      ctx.strokeStyle = '#2B354C';
      ctx.lineWidth = 2;
      ctx.stroke();

      roundRect(360, 118, 180, 26, 13);
      ctx.fillStyle = pillGrad;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('INVITED BY', 450, 135);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`code: ${code}`, 450, 162);

      // RIGHT: Inviter Avatar
      const iAvatarX = 770;
      const iAvatarY = 140;
      const iRadius = 58;

      ctx.save();
      ctx.beginPath();
      ctx.arc(iAvatarX, iAvatarY, iRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      try {
        const iUrl = inviterUser?.displayAvatarURL ? inviterUser.displayAvatarURL({ extension: 'png', size: 256 }) : null;
        if (iUrl) {
          const iImg = await loadImage(iUrl);
          ctx.drawImage(iImg, iAvatarX - iRadius, iAvatarY - iRadius, iRadius * 2, iRadius * 2);
        } else {
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(iAvatarX - iRadius, iAvatarY - iRadius, iRadius * 2, iRadius * 2);
        }
      } catch {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(iAvatarX - iRadius, iAvatarY - iRadius, iRadius * 2, iRadius * 2);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(iAvatarX, iAvatarY, iRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      const inviterCount = inviterRecord?.total != null ? inviterRecord.total : (inviterRecord?.regular || 0);
      roundRect(685, 212, 170, 24, 12);
      ctx.fillStyle = '#1A2030';
      ctx.fill();
      ctx.strokeStyle = '#2B354C';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`NOW HAS ${inviterCount} INVITES`, 770, 228);

      const iName = inviterUser ? inviterUser.username : (code === 'VANITY' ? 'Vanity URL' : 'Direct / Unknown');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(iName.length > 15 ? iName.substring(0, 15) + '...' : iName, 770, 258);

      ctx.fillStyle = '#8B949E';
      ctx.font = '12px sans-serif';
      ctx.fillText('Referral Ambassador', 770, 278);

      return canvas.toBuffer('image/png');
    } catch {}
  }

  // Option C: Pure SVG fallback
  return generateSvgInviteCard(options);
}

module.exports = {
  generateInviteCard,
  generateSvgInviteCard
};
