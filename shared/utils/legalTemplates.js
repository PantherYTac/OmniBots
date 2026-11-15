/**
 * Discord Verification-Compliant Legal Document Templates
 * Pre-written, legally thorough, and specifically tailored to Antigravity Discord Bot
 * Covering privileged gateway intents, sub-processors, zero data selling, and user deletion rights.
 */

function getDefaultPrivacyPolicy(contactEmail = 'support@yourdomain.com', supportServer = 'https://discord.gg/yourserver') {
  return `# Privacy Policy for Antigravity Discord Bot

**Effective Date:** January 1, 2025  
**Last Updated:** November 15, 2026  

Welcome to **Antigravity Discord Bot** ("we," "our," or "us"). We are committed to protecting your privacy and handling your data with transparency, integrity, and strict adherence to the **Discord Developer Terms of Service**, the **Discord Developer Policy**, and international data protection regulations (including GDPR and CCPA).

This Privacy Policy explains what information we collect, how it is used, how it is stored and protected, and your rights to access or permanently delete your data.

---

## 1. Information and Data We Collect

To provide server management, automated moderation, community leveling, economy games, ticket support, and interactive AI utilities, we collect and process specific Discord data:

### A. Discord Identifiers (Stored)
* **Discord User IDs & Usernames:** To identify users for leveling XP, economy balances, infractions, birthdays, reminders, and user-specific configuration.
* **Discord Guild (Server) IDs & Names:** To store server-specific settings, prefixes, auto-mod rules, ticket configurations, and logging channels.
* **Discord Channel & Role IDs:** To direct log messages, manage ticket categories, autoroles, and level-up rewards.

### B. Server Progression & Activity Metrics (Stored)
* **Leveling & Experience:** Message count estimates and text/voice XP earned within each server.
* **Server Economy & Virtual Inventory:** Virtual wallet balances, bank balances, daily streaks, and purchased role items.
* **Invite Tracking & Attribution:** Counts of regular joins, bonus invites awarded by administrators, member leaves, and anti-fake join flags (< 7 days account age).
* **Support Ticket Transcripts:** Ticket channel metadata and exported static HTML conversation transcripts (generated and saved only when explicitly requested by server staff).
* **Community Birthdays & Reminders:** User-provided birth dates (month/day) and scheduled reminder timestamps.

### C. Moderation & Audit Logs (Stored)
* **Infraction Records:** Warning counts, reason strings, moderator IDs, and active auto-escalation actions (timeouts, kicks, bans) issued within a specific guild.

### D. Temporary Message Content (Ephemeral Processing Only)
* **Auto-Moderation Filter:** In-transit message text is scanned in real-time RAM to detect prohibited links, banned keywords, Discord invite links, mass mentions, and excessive emojis. **Message contents are never stored in a permanent database for auto-moderation.**
* **Audit Logging:** If enabled by guild administrators, message edit diffs (before/after) and message deletions are formatted into an embed and delivered strictly to the guild's designated audit log channel.
* **AI Utilities (\`/ask\` Command):** Text prompts submitted to the \`/ask\` command are processed ephemerally to generate AI responses.

---

## 2. Privileged Discord Gateway Intents & Justifications

Our bot operates under explicit, privileged Discord Gateway Intents approved by Discord Inc.:

1. **\`MESSAGE_CONTENT\`:** Required strictly to inspect message content for real-time automated moderation (filtering scams, malicious URLs, and toxic keywords), execute legacy prefix commands, and process \`/ask\` AI inquiries.
2. **\`GUILD_MEMBERS\`:** Required to assign automatic roles upon join, restore sticky roles when members rejoin, deliver custom welcomer/farewell cards, track voice channel activity for voice XP, and maintain server statistics.
3. **\`GUILD_INVITES\`:** Required to detect and attribute member invitations, filter suspicious alt accounts, compute referral leaderboards, and award milestone invite roles.

---

## 3. Third-Party Sub-Processors & Data Sharing

We do **not** sell, rent, monetize, or trade your personal information. We engage only with reputable cloud infrastructure providers necessary to operate our service:

* **Hostinger International Ltd.:** High-performance cloud application hosting provider where our Node.js runtime environment and web dashboard execute.
* **Database Infrastructure (MongoDB / PostgreSQL / Encrypted Storage):** Secure, access-controlled databases used to persist guild configurations, user balances, and moderation logs. Data is encrypted in transit (TLS 1.3) and at rest (AES-256).
* **Google Gemini API (@google/genai):** Used solely for processing text queries submitted directly to the \`/ask\` slash command.  
  > **Important AI Safety Guarantee:** User queries processed via the Google Gemini API are strictly handled for inference and **are NOT used to train Google's AI models** or stored beyond the immediate API response window.

---

## 4. Zero Data Selling Guarantee

We explicitly state:
* We **NEVER** sell, license, rent, or distribute Discord API data or user information to third-party data brokers, advertisers, marketing firms, or analytics companies.
* We **NEVER** build behavioral advertising profiles based on your Discord messages or server interactions.
* Data collected is used exclusively to deliver the functionality requested by server members and administrators.

---

## 5. Data Retention & Automatic Cleanup

* **Active Usage:** Server data remains active as long as the bot resides in the guild and the service is actively utilized.
* **Server Departure:** If our bot is removed or kicked from a Discord server, the server's configuration and associated data are retained for a 30-day grace period (to prevent accidental data loss during re-invites), after which they are permanently purged.
* **Audit Logs:** Audit logs and moderation infraction history older than 90 days are automatically archived or purged.

---

## 6. User Rights & Immediate Self-Service Deletion (\`/delete-my-data\`)

You retain absolute ownership and control over your personal data:

1. **Instant Self-Service Deletion:** Any user may run the \`/delete-my-data\` slash command in any server where the bot is present. Upon interactive confirmation, all personal leveling XP, economy balances, inventory items, birthday records, scheduled reminders, and invite statistics associated with your User ID will be **immediately and permanently erased** from our database.
2. **Right to Know / Access:** You may view your stored data at any time using commands like \`/rank\`, \`/balance\`, \`/invites\`, and \`/warnings\`.
3. **Manual Deletion Request:** You may email our Data Protection representative at **${contactEmail}** or contact us on our Discord Support Server to request a comprehensive manual review or purge of any records associated with your Discord account.

---

## 7. Security Safeguards

We implement industry-standard security measures including:
* Constant-time cryptographic verification (bcrypt SALT_ROUNDS = 12) for dashboard access.
* TLS/HTTPS encryption for all web dashboard sessions with HTTP-only, secure, SameSite cookies.
* Strict input validation, brute-force rate limiters, and session fixation defenses.
* Least-privilege API token handling and environment variable isolation.

---

## 8. Updates to this Policy

We may update this Privacy Policy from time to time to reflect changes in our features, Discord API policies, or applicable laws. Changes take effect immediately upon publication on this page. The "Last Updated" timestamp at the top indicates the latest revision.

---

## 9. Contact Information

If you have questions, concerns, or inquiries regarding this Privacy Policy or our data practices, please contact us:

* **Official Contact Email:** [${contactEmail}](mailto:${contactEmail})
* **Discord Community Support Server:** [${supportServer}](${supportServer})
`;
}

function getDefaultTermsOfService(contactEmail = 'support@yourdomain.com', supportServer = 'https://discord.gg/yourserver') {
  return `# Terms of Service for Antigravity Discord Bot

**Effective Date:** January 1, 2025  
**Last Updated:** November 15, 2026  

Please read these Terms of Service ("Terms") carefully before adding **Antigravity Discord Bot** ("the Bot") to your Discord server or utilizing its associated Web Dashboard and slash commands.

By inviting the Bot, accessing the dashboard, or interacting with any Bot features, you agree to be bound by these Terms and our [Privacy Policy](/privacy). If you do not agree to these Terms, you must immediately remove the Bot from your server and discontinue all use.

---

## 1. Eligibility & Age Requirements

* **Minimum Age:** You must be at least **13 years of age** (or the minimum legal age required in your country of residence to use online services) to use the Bot, in strict accordance with [Discord's Terms of Service](https://discord.com/terms).
* **Authority:** If you add the Bot to a Discord server, you represent and warrant that you possess the necessary administrative permissions (e.g., \`Manage Server\` or \`Administrator\`) to bind that server to these Terms.

---

## 2. Permitted Use & Service Description

The Bot provides server management tools, automated moderation, leveling and rank cards, economy minigames, reaction roles, support ticket management, and artificial intelligence utilities. You are granted a limited, revocable, non-exclusive, non-transferable license to use the Bot for non-commercial server administration and community engagement.

---

## 3. Prohibited Conduct

You agree that you will **NOT** under any circumstances:

1. **Exploit or Abuse Systems:** Use bugs, macros, auto-clickers, self-bots, or automated scripts to manipulate leveling XP, economy coins, leaderboard standings, or minigames.
2. **Harmful or Illegal Content:** Use the Bot's embed builders, custom commands, welcomer messages, or \`/ask\` AI interface to create, store, or transmit content that is illegal, defamatory, hateful, abusive, threatening, infringing on intellectual property, or containing malware/phishing links.
3. **Disrupt Service:** Attempt to flood, DDoS, reverse engineer, decompile, or bypass rate limits, authentication gates, or access controls of the Bot or its Web Dashboard.
4. **Violate Discord Policies:** Use the Bot in any manner that violates [Discord's Community Guidelines](https://discord.com/guidelines) or [Discord's Developer Terms of Service](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service).

---

## 4. Virtual Currency & Economy Disclaimer

* **Zero Monetary Value:** All virtual currency (such as Coins), experience points (XP), levels, badges, and server shop items generated or managed by the Bot are purely digital amusement mechanics.
* **No Real-World Value:** Virtual items and currencies have **ZERO real-world monetary value**, cannot be exchanged for fiat currency, cryptocurrencies, or tangible goods/services, and cannot be transferred outside of the specific Discord server where they were awarded.
* **Reset Rights:** Server administrators and Bot operators reserve the unrestricted right to modify, adjust, deduct, or reset economy balances, XP levels, and inventory items at any time without prior notice or liability.

---

## 5. Support Tickets & Server Staff Responsibility

* The Bot provides tools for server administrators to configure private support ticket channels and export HTML transcripts.
* The content of tickets, transcripts, and member interactions is solely the responsibility of the respective server administrators and ticket participants.
* Bot operators do not monitor private ticket channels unless requested to do so for technical support or security auditing.

---

## 6. Service Availability & "As-Is" Disclaimer

* **Availability:** The Bot and Web Dashboard are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. While we strive for 99.9% uptime on Hostinger infrastructure, we do not guarantee uninterrupted, error-free, or continuous service.
* **Modifications:** We reserve the right to alter, update, deprecate, or suspend any feature, command, or module of the Bot at our discretion with or without notice.

---

## 7. Limitation of Liability

To the maximum extent permitted by applicable law, the Bot developers, contributors, and hosting operators shall not be held liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of server progress, unauthorized server access, or service interruptions resulting from:
1. The use of or inability to use the Bot.
2. Actions, moderation decisions, or infractions executed by server administrators utilizing Bot tools.
3. Any unauthorized access to or alteration of your transmissions or data.

---

## 8. Termination & Access Revocation

We reserve the right, without prior notice or liability, to suspend, terminate, or blacklist any user, Discord account, or Discord server from accessing the Bot or Web Dashboard if we determine, in our sole discretion, that these Terms, Discord's Community Guidelines, or applicable laws have been violated.

Users may terminate their agreement at any time by kicking or banning the Bot from their server and executing the \`/delete-my-data\` command to purge their user records.

---

## 9. Contact & Support

For inquiries, support questions, or notices regarding these Terms of Service, please contact:

* **Official Contact Email:** [${contactEmail}](mailto:${contactEmail})
* **Discord Community Support Server:** [${supportServer}](${supportServer})
`;
}

function createDefaultLegalDocuments(contactEmail = 'support@yourdomain.com', supportServer = 'https://discord.gg/yourserver') {
  const now = new Date();
  return {
    privacyPolicy: {
      content: getDefaultPrivacyPolicy(contactEmail, supportServer),
      updatedAt: now
    },
    termsOfService: {
      content: getDefaultTermsOfService(contactEmail, supportServer),
      updatedAt: now
    },
    contactEmail,
    supportServerInvite: supportServer,
    updatedAt: now
  };
}

module.exports = {
  getDefaultPrivacyPolicy,
  getDefaultTermsOfService,
  createDefaultLegalDocuments
};
