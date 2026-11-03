import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SessionManager } from '../sessionManager.js';
import { config } from '../../config/env.js';

export const statusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays connection status, active Spotify playback, and audio metrics'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const sessionManager = SessionManager.getInstance();
    const session = sessionManager.getSession(interaction.guild.id);

    if (!session) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('⚪ Status: Idle')
        .setDescription(
          'Not connected to any voice channel.\nUse `/connect` while in a voice channel to start Spotify Connect.'
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const currentTrack = session.librespot.getCurrentTrack();
    const playbackStatus = session.librespot.getStatus();
    const playerStatus = session.audioBridge.getPlayerStatus();
    const volume = session.audioBridge.getVolume();
    const uptimeSeconds = session.startedAt
      ? Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
      : 0;

    const formatUptime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}m ${s}s`;
    };

    const statusIcons: Record<string, string> = {
      playing: '▶️ Playing',
      paused: '⏸️ Paused',
      ready: '🟢 Ready / Standby',
      starting: '⏳ Starting',
      stopped: '⏹️ Stopped',
      error: '❌ Error',
    };

    const embed = new EmbedBuilder()
      .setColor(playbackStatus === 'playing' ? 0x1db954 : 0x3498db)
      .setTitle('📊 Spotify Connect Bot Status')
      .addFields(
        {
          name: '🔊 Voice Channel',
          value: `<#${session.channelId}>`,
          inline: true,
        },
        {
          name: '📱 Device Name',
          value: `\`${session.librespot.getDeviceName()}\``,
          inline: true,
        },
        {
          name: '📻 Playback State',
          value: statusIcons[playbackStatus] || playbackStatus,
          inline: true,
        },
        {
          name: '🎵 Current Track',
          value: currentTrack
            ? `**${currentTrack.title}**${
                currentTrack.durationMs
                  ? ` (${formatUptime(Math.floor(currentTrack.durationMs / 1000))})`
                  : ''
              }`
            : '*None (Waiting for playback from Spotify app)*',
          inline: false,
        },
        {
          name: '🎚️ Volume',
          value: `${volume}%`,
          inline: true,
        },
        {
          name: '🎛️ Audio Player',
          value: `\`${playerStatus}\``,
          inline: true,
        },
        {
          name: '📶 Bitrate',
          value: `\`${config.LIBRESPOT_BITRATE} kbps Opus\``,
          inline: true,
        },
        {
          name: '⚙️ Librespot Process',
          value: `PID: \`${session.librespot.getPid() ?? 'N/A'}\` | Uptime: \`${formatUptime(
            uptimeSeconds
          )}\``,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
