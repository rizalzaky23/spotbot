import { Client, GatewayIntentBits } from 'discord.js';
import { onReady } from './events/ready.js';
import { onInteractionCreate } from './events/interactionCreate.js';
import { onVoiceStateUpdate } from './events/voiceStateUpdate.js';

export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once('ready', () => onReady(client));
  client.on('interactionCreate', onInteractionCreate);
  client.on('voiceStateUpdate', onVoiceStateUpdate);

  return client;
}
