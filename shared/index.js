// Global BigInt JSON serialization polyfill
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

const db = require('./database');
const logger = require('./utils/logger');
const helpers = require('./utils/helpers');

module.exports = {
  db,
  logger,
  helpers
};
