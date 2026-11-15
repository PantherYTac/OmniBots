/**
 * Slash Command Global Deployment Script
 * Run with: npm run deploy:commands
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const categories = fs.readdirSync(commandsPath);

for (const category of categories) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(categoryPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
      commands.push(command.data.toJSON());
    }
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  logger.error('Missing DISCORD_TOKEN or CLIENT_ID in .env file!', null, 'DEPLOY');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info(`Deploying ${commands.length} application (/) commands to Discord...`, 'DEPLOY');

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    logger.success(`Successfully registered ${data.length} global slash commands!`, 'DEPLOY');
  } catch (error) {
    logger.error('Failed to register slash commands', error, 'DEPLOY');
    process.exit(1);
  }
})();
