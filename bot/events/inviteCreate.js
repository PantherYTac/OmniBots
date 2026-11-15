/**
 * Event: inviteCreate
 * Tracks new invites created dynamically and adds them to the cache
 */

const { handleInviteCreate } = require('../utils/inviteTracker');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    if (!invite || !invite.guild) return;
    handleInviteCreate(invite);
  }
};
