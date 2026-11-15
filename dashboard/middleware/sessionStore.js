/**
 * Persistent Database Session Store for express-session
 * Backed by shared/database.js (MongoDB, PostgreSQL, or Local JSON/SQLite fallback)
 * Persists logins across Hostinger Node.js restarts with zero memory leaks
 */

const session = require('express-session');
const { db } = require('../../shared');

class DatabaseSessionStore extends session.Store {
  constructor() {
    super();
  }

  async get(sid, callback) {
    try {
      const record = await db.sessions.get(sid);
      if (!record) return callback(null, null);

      if (record.expires && new Date(record.expires).getTime() <= Date.now()) {
        await db.sessions.destroy(sid);
        return callback(null, null);
      }

      return callback(null, record.data);
    } catch (err) {
      return callback(err);
    }
  }

  async set(sid, sess, callback) {
    try {
      const maxAge = sess.cookie?.maxAge || 7 * 24 * 60 * 60 * 1000;
      const expires = new Date(Date.now() + maxAge);
      await db.sessions.set(sid, sess, expires);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await db.sessions.destroy(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  async touch(sid, sess, callback) {
    return this.set(sid, sess, callback);
  }
}

module.exports = DatabaseSessionStore;
