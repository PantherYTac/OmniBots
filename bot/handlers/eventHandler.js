/**
 * Dynamic Discord Event Handler
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);
      const eventName = event.name || file.split('.')[0];

      if (event.once) {
        client.once(eventName, (...args) => event.execute(...args, client));
      } else {
        client.on(eventName, (...args) => event.execute(...args, client));
      }
    } catch (err) {
      logger.error(`Error loading event file ${file}`, err, 'EVENTS');
    }
  }

  logger.info(`Loaded ${eventFiles.length} Discord gateway event listeners.`, 'EVENTS');
}

module.exports = { loadEvents };
