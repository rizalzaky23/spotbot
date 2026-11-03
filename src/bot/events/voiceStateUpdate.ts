import { VoiceState } from 'discord.js';
import { SessionManager } from '../sessionManager.js';

export async function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const sessionManager = SessionManager.getInstance();
  const botId = newState.client.user?.id;
  const guildId = newState.guild.id;

  const session = sessionManager.getSession(guildId);
  if (!session) return;

  // 1. If the bot itself was disconnected/kicked from the voice channel
  if (oldState.id === botId && !newState.channelId) {
    console.log(`[VoiceState] Bot was disconnected from channel in guild ${guildId}`);
    await sessionManager.destroySession(guildId);
    return;
  }

  // 2. Check if the bot's current channel is now empty (only bots or nobody left)
  const channel = newState.guild.channels.cache.get(session.channelId);
  if (channel && channel.isVoiceBased()) {
    const humanMembers = channel.members.filter((member) => !member.user.bot);
    const isEmpty = humanMembers.size === 0;

    sessionManager.handleEmptyChannel(guildId, isEmpty);
  }
}
