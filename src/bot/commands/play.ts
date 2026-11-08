import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SessionManager } from '../sessionManager.js';
import { QueueManager } from '../queueManager.js';
import { StreamExtractor } from '../../audio/streamExtractor.js';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription(
      'Putar musik dari link YouTube/Spotify atau pencarian judul (dengan Autoplay lagu selaras)'
    )
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('URL YouTube, URL Spotify, atau judul lagu yang ingin dicari')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: '❌ Perintah ini hanya dapat digunakan di dalam server Discord.',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Kamu harus berada di voice channel terlebih dahulu untuk menggunakan perintah ini!',
        ephemeral: true,
      });
      return;
    }

    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions || !permissions.has(['Connect', 'Speak'])) {
      await interaction.reply({
        content: '❌ Bot tidak memiliki izin Connect / Speak di voice channel tersebut!',
        ephemeral: true,
      });
      return;
    }

    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    try {
      // 1. Resolve query into TrackInfo
      console.log(`[Command: play] Resolving query "${query}" requested by ${interaction.user.tag}...`);
      const track = await StreamExtractor.resolveTrack(query, interaction.user.tag);

      if (!track) {
        await interaction.editReply({
          content: `❌ Tidak dapat menemukan lagu untuk: \`${query}\`. Pastikan judul atau link valid.`,
        });
        return;
      }

      // 2. Ensure voice session is active in Queue mode
      const sessionManager = SessionManager.getInstance();
      await sessionManager.getOrCreateQueueSession(voiceChannel);

      // 3. Add track to QueueManager
      const queueManager = QueueManager.getInstance();
      const channel = interaction.channel ?? (interaction.channelId ? await interaction.client.channels.fetch(interaction.channelId) : null);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: '❌ Saluran teks tidak valid.' });
        return;
      }

      const { position, isPlayingNow } = await queueManager.addTrack(
        interaction.guild.id,
        track,
        channel
      );

      if (isPlayingNow) {
        await interaction.editReply({
          content: `🎶 **Memulai pemutaran:** [${track.title}](${track.url})`,
        });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x1db954)
          .setTitle('✅ Ditambahkan ke Antrean')
          .setDescription(`[**${track.title}**](${track.url})`)
          .addFields(
            { name: '👤 Artis / Channel', value: track.author || 'N/A', inline: true },
            { name: '⏱️ Durasi', value: track.duration || 'N/A', inline: true },
            { name: '🔢 Posisi Antrean', value: `#${position}`, inline: true }
          )
          .setFooter({
            text: '✨ Fitur Autoplay aktif: lagu selaras berikutnya akan diputar otomatis saat antrean habis',
          });

        if (track.thumbnail) {
          embed.setThumbnail(track.thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[Command: play] Error:', error);
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat memutar lagu: ${(error as Error).message}`,
      });
    }
  },
};
