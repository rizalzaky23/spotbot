import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SessionManager } from '../sessionManager.js';
import { QueueManager } from '../queueManager.js';
import { config } from '../../config/env.js';

export const statusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays connection status, active playback, and audio metrics'),

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
          'Not connected to any voice channel.\nUse `/play <judul/link>` to play music or `/connect` for Spotify Connect.'
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

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

    if (session.mode === 'queue') {
      const queue = QueueManager.getInstance().getQueue(interaction.guild.id);
      const currentTrack = queue?.currentTrack;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('📊 SpotBot Status — Music Player')
        .addFields(
          {
            name: '🔊 Voice Channel',
            value: `<#${session.channelId}>`,
            inline: true,
          },
          {
            name: '📻 Player State',
            value: `\`${playerStatus.toUpperCase()}\``,
            inline: true,
          },
          {
            name: '🎚️ Volume',
            value: `${volume}%`,
            inline: true,
          },
          {
            name: '🎵 Lagu Saat Ini',
            value: currentTrack
              ? `[**${currentTrack.title}**](${currentTrack.url})\n👤 ${currentTrack.author} • ⏱️ ${currentTrack.duration}`
              : '*Tidak ada lagu yang sedang diputar*',
            inline: false,
          },
          {
            name: '✨ Autoplay Selaras',
            value: queue?.isAutoplay ? '🟢 **Aktif**' : '⚪ Nonaktif',
            inline: true,
          },
          {
            name: '📑 Sisa Antrean',
            value: `\`${queue?.tracks.length || 0} lagu\``,
            inline: true,
          },
          {
            name: '⏱️ Uptime Sesi',
            value: formatUptime(uptimeSeconds),
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Spotify Connect Mode
    const currentTrack = session.librespot?.getCurrentTrack();
    const playbackStatus = session.librespot?.getStatus() || 'idle';

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
      .setTitle('📊 SpotBot Status — Spotify Connect')
      .addFields(
        {
          name: '🔊 Voice Channel',
          value: `<#${session.channelId}>`,
          inline: true,
        },
        {
          name: '📱 Device Name',
          value: `\`${session.librespot?.getDeviceName() ?? 'N/A'}\``,
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
          value: `PID: \`${session.librespot?.getPid() ?? 'N/A'}\` | Uptime: \`${formatUptime(
            uptimeSeconds
          )}\``,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
