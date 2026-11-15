/**
 * Dynamic Slash Command Handler
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

function loadCommands(client) {
  client.commands.clear();
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) return;

  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
        } else {
          logger.warn(`Command at ${filePath} is missing data or execute export.`, 'COMMANDS');
        }
      } catch (err) {
        logger.error(`Error loading command file ${file}`, err, 'COMMANDS');
      }
    }
  }

  logger.info(`Loaded ${client.commands.size} application slash commands.`, 'COMMANDS');
}

module.exports = { loadCommands };
