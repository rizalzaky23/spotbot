import { ActivityType, Client, REST, Routes } from 'discord.js';
import { commands } from '../commands/index.js';
import { config } from '../../config/env.js';

export async function onReady(client: Client): Promise<void> {
  console.log(`[Bot] Logged in as ${client.user?.tag} (${client.user?.id})`);

  // Set initial status presence
  client.user?.setPresence({
    activities: [
      {
        name: 'Spotify Connect | /connect',
        type: ActivityType.Listening,
      },
    ],
    status: 'online',
  });

  // Register Slash Commands
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const commandData = commands.map((cmd) => cmd.data.toJSON());

  try {
    console.log(`[Bot] Registering ${commandData.length} application slash commands...`);

    if (config.DISCORD_GUILD_ID) {
      // Guild-specific registration for fast instant testing
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body: commandData }
      );
      console.log(
        `[Bot] Successfully registered slash commands for guild: ${config.DISCORD_GUILD_ID}`
      );
    } else {
      // Global registration
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
        body: commandData,
      });
      console.log('[Bot] Successfully registered slash commands globally.');
    }
  } catch (error) {
    console.error('[Bot] Failed to register slash commands:', error);
  }
}
