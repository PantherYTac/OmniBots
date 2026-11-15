/**
 * HTML Transcript Generator for Support Tickets
 */

async function generateHtmlTranscript(channel, ticket, guild) {
  const messages = [];
  let lastId;

  // Fetch up to 500 messages from the ticket channel
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const fetched = await channel.messages.fetch(options);
    if (fetched.size === 0) break;

    messages.push(...Array.from(fetched.values()));
    lastId = fetched.last().id;

    if (messages.length >= 500) break;
  }

  // Reverse so chronological order
  messages.reverse();

  const formattedMessagesHtml = messages.map(msg => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const time = msg.createdAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const botBadge = msg.author.bot ? '<span class="bot-tag">BOT</span>' : '';

    let contentHtml = escapeHtml(msg.cleanContent || '');

    // Render attachments
    let attachmentsHtml = '';
    if (msg.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">' + msg.attachments.map(att => {
        if (att.contentType && att.contentType.startsWith('image/')) {
          return `<div class="attachment-image"><img src="${att.url}" alt="${att.name}" loading="lazy"/></div>`;
        }
        return `<div class="attachment-file"><a href="${att.url}" target="_blank">📎 ${escapeHtml(att.name)}</a></div>`;
      }).join('') + '</div>';
    }

    // Render embeds
    let embedsHtml = '';
    if (msg.embeds.length > 0) {
      embedsHtml = '<div class="embeds">' + msg.embeds.map(emb => {
        const title = emb.title ? `<div class="embed-title">${escapeHtml(emb.title)}</div>` : '';
        const desc = emb.description ? `<div class="embed-desc">${escapeHtml(emb.description)}</div>` : '';
        const color = emb.hexColor || '#5865F2';
        return `<div class="embed" style="border-left-color: ${color}">${title}${desc}</div>`;
      }).join('') + '</div>';
    }

    return `
      <div class="message-row">
        <img class="avatar" src="${avatar}" alt="${msg.author.username}" />
        <div class="message-content">
          <div class="message-header">
            <span class="username">${escapeHtml(msg.author.username)}</span>
            ${botBadge}
            <span class="timestamp">${time}</span>
          </div>
          <div class="text">${contentHtml}</div>
          ${attachmentsHtml}
          ${embedsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ticket Transcript: ${escapeHtml(channel.name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0B0E14;
      color: #DCDDDE;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      background: #131823;
      border: 1px solid #1E2538;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header h1 { font-size: 22px; color: #FFFFFF; }
    .header .meta { color: #8B949E; font-size: 14px; margin-top: 4px; }
    .badge {
      background: rgba(88, 101, 242, 0.2);
      color: #5865F2;
      border: 1px solid #5865F2;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 13px;
    }
    .chat-container {
      background: #131823;
      border: 1px solid #1E2538;
      border-radius: 12px;
      padding: 20px;
    }
    .message-row {
      display: flex;
      gap: 16px;
      padding: 12px 8px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .message-row:hover { background: #181F2E; }
    .avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #1E2538;
      flex-shrink: 0;
    }
    .message-content { flex: 1; min-width: 0; }
    .message-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .username { font-weight: 600; color: #FFFFFF; font-size: 15px; }
    .timestamp { font-size: 12px; color: #8B949E; }
    .bot-tag {
      background: #5865F2;
      color: #FFF;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .text { color: #DCDDDE; font-size: 14px; word-break: break-word; white-space: pre-wrap; }
    .embed {
      margin-top: 8px;
      background: #181F2E;
      border-left: 4px solid #5865F2;
      border-radius: 4px;
      padding: 12px;
      max-width: 520px;
    }
    .embed-title { font-weight: bold; color: #FFF; margin-bottom: 4px; }
    .embed-desc { font-size: 13px; color: #8B949E; }
    .attachment-image img { max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; }
    .attachment-file a { color: #5865F2; text-decoration: none; font-size: 13px; }
    .footer { text-align: center; margin-top: 30px; color: #6E7681; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Ticket: #${escapeHtml(channel.name)}</h1>
      <div class="meta">Server: ${escapeHtml(guild.name)} • Messages: ${messages.length} • Category: ${escapeHtml(ticket.category || 'General')}</div>
    </div>
    <div class="badge">Exported: ${new Date().toLocaleDateString()}</div>
  </div>

  <div class="chat-container">
    ${formattedMessagesHtml || '<div style="text-align: center; color: #8B949E; padding: 40px;">No messages in this ticket.</div>'}
  </div>

  <div class="footer">
    Generated by All-in-One Discord Bot & Dashboard System • Hostinger Node.js Ready
  </div>
</body>
</html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { generateHtmlTranscript };
