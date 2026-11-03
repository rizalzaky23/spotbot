import { Client, Events, GatewayIntentBits } from 'discord.js';
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

  client.once(Events.ClientReady, () => onReady(client));
  client.on(Events.InteractionCreate, onInteractionCreate);
  client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);

  return client;
}
