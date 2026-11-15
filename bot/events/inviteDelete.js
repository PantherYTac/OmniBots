/**
 * Event: inviteDelete
 * Cleans up deleted invites from the local cache
 */

const { handleInviteDelete } = require('../utils/inviteTracker');

module.exports = {
  name: 'inviteDelete',
  async execute(invite) {
    if (!invite || !invite.guild) return;
    handleInviteDelete(invite);
  }
};
