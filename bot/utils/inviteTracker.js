/**
 * Full Invite Tracking & Attribution Engine
 * Caches guild invites, detects inviter/vanity on join, handles anti-fake checks,
 * attributes departures on member leave, and manages automatic invite role reward milestones.
 */

const { db } = require('../../shared');
const logger = require('../../shared/utils/logger');

// guildId -> Map(code -> { code, uses, inviterId })
const guildInvitesCache = new Map();
// guildId -> number (vanity uses)
const guildVanityCache = new Map();

/**
 * Initialize invite cache for all accessible guilds
 */
async function initInvitesCache(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const inviteMap = new Map();
      if (guild.members.me?.permissions.has('ManageGuild')) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
          for (const inv of invites.values()) {
            inviteMap.set(inv.code, {
              code: inv.code,
              uses: inv.uses || 0,
              inviterId: inv.inviter?.id || null
            });
          }
        }

        // Cache vanity url if supported
        if (guild.features.includes('VANITY_URL')) {
          const vanity = await guild.fetchVanityData().catch(() => null);
          if (vanity) {
            guildVanityCache.set(guild.id, vanity.uses || 0);
          }
        }
      }
      guildInvitesCache.set(guild.id, inviteMap);
    } catch (err) {
      logger.warn(`Could not cache invites for guild ${guild.name} (${guild.id}): ${err.message}`, 'INVITES');
    }
  }
  logger.success(`Invite cache initialized for ${guildInvitesCache.size} guilds.`, 'INVITES');
}

/**
 * Handle new invite creation event
 */
function handleInviteCreate(invite) {
  const guildMap = guildInvitesCache.get(invite.guild.id) || new Map();
  guildMap.set(invite.code, {
    code: invite.code,
    uses: invite.uses || 0,
    inviterId: invite.inviter?.id || null
  });
  guildInvitesCache.set(invite.guild.id, guildMap);
}

/**
 * Handle invite deletion event
 */
function handleInviteDelete(invite) {
  const guildMap = guildInvitesCache.get(invite.guild.id);
  if (guildMap) {
    guildMap.delete(invite.code);
  }
}

/**
 * Check and apply or strip invite role rewards based on net invite count
 */
async function checkRoleRewards(guild, inviterId, inviterRecord, settings) {
  try {
    const rewards = settings.inviteTracking?.rewards;
    if (!Array.isArray(rewards) || rewards.length === 0) return;

    const subtractLeaves = settings.inviteTracking?.subtractLeaves !== false;
    const net = (inviterRecord.regular || 0) + (inviterRecord.bonus || 0) - (subtractLeaves ? (inviterRecord.leaves || 0) : 0);

    const inviterMember = await guild.members.fetch(inviterId).catch(() => null);
    if (!inviterMember) return;

    for (const reward of rewards) {
      const threshold = parseInt(reward.threshold, 10);
      const roleId = reward.roleId;
      if (!threshold || !roleId) continue;

      const role = guild.roles.cache.get(roleId);
      if (!role) continue;

      if (net >= threshold) {
        if (!inviterMember.roles.cache.has(roleId)) {
          await inviterMember.roles.add(roleId).catch(() => null);
          logger.info(`Granted invite reward role ${role.name} to ${inviterMember.user.tag} (${net} net invites)`, 'INVITES');
        }
      } else if (subtractLeaves) {
        if (inviterMember.roles.cache.has(roleId)) {
          await inviterMember.roles.remove(roleId).catch(() => null);
          logger.info(`Removed invite reward role ${role.name} from ${inviterMember.user.tag} (net invites dropped to ${net})`, 'INVITES');
        }
      }
    }
  } catch (err) {
    logger.error('Error evaluating invite role rewards', err, 'INVITES');
  }
}

/**
 * Attribute member join to inviter or vanity link
 * Returns details for welcomer and logging placeholders:
 * { inviterUser, inviterRecord, code, isFake, isVanity, netInvites }
 */
async function trackMemberJoin(member) {
  const guild = member.guild;
  const result = {
    inviterUser: null,
    inviterRecord: null,
    code: 'UNKNOWN',
    isFake: false,
    isVanity: false,
    netInvites: 0
  };

  try {
    const settings = await db.guilds.get(guild.id);
    if (settings.modules?.inviteTracker === false || settings.inviteTracking?.enabled === false) {
      return result;
    }

    // Check account age (Anti-Fake)
    const minAgeDays = settings.inviteTracking?.minAccountAgeDays ?? 7;
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const isFake = accountAgeDays < minAgeDays;
    result.isFake = isFake;

    let usedCode = null;
    let inviterId = null;
    let isVanity = false;

    // Fetch fresh invites
    if (guild.members.me?.permissions.has('ManageGuild')) {
      const cachedMap = guildInvitesCache.get(guild.id) || new Map();
      const currentInvites = await guild.invites.fetch().catch(() => null);

      if (currentInvites) {
        // Compare uses to find which invite was consumed
        for (const [code, inv] of currentInvites.entries()) {
          const cached = cachedMap.get(code);
          if (cached && inv.uses > cached.uses) {
            usedCode = code;
            inviterId = inv.inviter?.id || cached.inviterId;
            break;
          }
        }

        // Check if vanity URL was used
        if (!usedCode && guild.features.includes('VANITY_URL')) {
          const vanity = await guild.fetchVanityData().catch(() => null);
          const cachedVanityUses = guildVanityCache.get(guild.id) || 0;
          if (vanity && vanity.uses > cachedVanityUses) {
            isVanity = true;
            usedCode = vanity.code;
            inviterId = 'VANITY';
            guildVanityCache.set(guild.id, vanity.uses);
          }
        }

        // Update the cache with latest invites
        const updatedMap = new Map();
        for (const inv of currentInvites.values()) {
          updatedMap.set(inv.code, {
            code: inv.code,
            uses: inv.uses || 0,
            inviterId: inv.inviter?.id || null
          });
        }
        guildInvitesCache.set(guild.id, updatedMap);
      }
    }

    result.code = usedCode || 'UNKNOWN';
    result.isVanity = isVanity;

    // Persist joined member tracking entry
    await db.inviteMembers.set(guild.id, member.id, {
      inviterId: inviterId || (isVanity ? 'VANITY' : 'UNKNOWN'),
      code: result.code,
      isFake,
      joinedAt: Date.now()
    });

    // If invited by a registered user, record attribution and update metrics
    if (inviterId && inviterId !== 'VANITY' && inviterId !== 'UNKNOWN') {
      const updatedRecord = await db.invites.recordJoin(guild.id, inviterId, isFake);
      result.inviterRecord = updatedRecord;

      const subtractLeaves = settings.inviteTracking?.subtractLeaves !== false;
      result.netInvites = (updatedRecord.regular || 0) + (updatedRecord.bonus || 0) - (subtractLeaves ? (updatedRecord.leaves || 0) : 0);

      // Fetch inviter user object
      const inviterUser = await member.client.users.fetch(inviterId).catch(() => null);
      result.inviterUser = inviterUser;

      // Trigger automatic milestone role rewards check
      await checkRoleRewards(guild, inviterId, updatedRecord, settings);
    }
  } catch (err) {
    logger.error('Error tracking member join invite', err, 'INVITES');
  }

  return result;
}

/**
 * Attribute member departure to original inviter on GuildMemberRemove
 */
async function trackMemberLeave(member) {
  try {
    const guild = member.guild;
    const settings = await db.guilds.get(guild.id);
    if (settings.modules?.inviteTracker === false || settings.inviteTracking?.enabled === false) {
      return null;
    }

    // Retrieve original inviter info
    const joinInfo = await db.inviteMembers.get(guild.id, member.id);
    if (!joinInfo || !joinInfo.inviterId) return null;

    const inviterId = joinInfo.inviterId;
    if (inviterId !== 'VANITY' && inviterId !== 'UNKNOWN') {
      // Increment leaves count for inviter
      const updatedRecord = await db.invites.recordLeave(guild.id, inviterId);

      // Check if role rewards need to be stripped
      await checkRoleRewards(guild, inviterId, updatedRecord, settings);

      return {
        inviterId,
        updatedRecord
      };
    }
  } catch (err) {
    logger.error('Error tracking member leave invite', err, 'INVITES');
  }
  return null;
}

module.exports = {
  initInvitesCache,
  handleInviteCreate,
  handleInviteDelete,
  trackMemberJoin,
  trackMemberLeave,
  checkRoleRewards
};
