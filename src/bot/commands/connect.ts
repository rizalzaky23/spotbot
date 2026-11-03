import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SessionManager } from '../sessionManager.js';
import { config } from '../../config/env.js';

export const connectCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('connect')
    .setDescription('Connects the bot to your voice channel and starts Spotify Connect receiver'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: '❌ This command can only be used inside a Discord server.',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You must be in a voice channel to use this command!',
        ephemeral: true,
      });
      return;
    }

    // Check permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions || !permissions.has(['Connect', 'Speak'])) {
      await interaction.reply({
        content: '❌ I do not have permission to join or speak in that voice channel!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const sessionManager = SessionManager.getInstance();
      const session = await sessionManager.createSession(voiceChannel);
      const deviceName = session.librespot.getDeviceName();

      const embed = new EmbedBuilder()
        .setColor(0x1db954) // Spotify Green
        .setTitle('🟢 Spotify Connect Receiver Active')
        .setDescription(
          `Connected to **<#${voiceChannel.id}>**!\nThe bot is now discoverable as a Spotify Connect device.`
        )
        .addFields(
          {
            name: '📱 Device Name',
            value: `\`${deviceName}\``,
            inline: true,
          },
          {
            name: '🎵 Audio Quality',
            value: `\`${config.LIBRESPOT_BITRATE} kbps Opus\``,
            inline: true,
          },
          {
            name: '🔊 Initial Volume',
            value: `\`${config.LIBRESPOT_INITIAL_VOLUME}%\``,
            inline: true,
          },
          {
            name: '🚀 How to stream from Spotify:',
            value:
              '1. Open the **Spotify app** on your Phone, Desktop, or Web.\n' +
              '2. Click the **Connect to a device** icon (speaker / monitor icon).\n' +
              `3. Select **"${deviceName}"**.\n` +
              '4. Play any track or playlist — audio will stream here in real-time!',
          }
        )
        .setFooter({
          text: 'Requires Spotify Premium • Control playback directly from your Spotify app',
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Command: connect] Error:', error);
      await interaction.editReply({
        content: `❌ Failed to start Spotify Connect receiver: ${(error as Error).message}`,
      });
    }
  },
};
