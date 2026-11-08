import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Lihat daftar antrean musik saat ini dan status Autoplay'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ Perintah ini hanya dapat digunakan di dalam server Discord.',
        ephemeral: true,
      });
      return;
    }

    const queueManager = QueueManager.getInstance();
    const queue = queueManager.getQueue(interaction.guild.id);

    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
      await interaction.reply({
        content: '📭 Antrean musik saat ini kosong. Putar lagu dengan `/play <judul/link>`!',
      });
      return;
    }

    const current = queue.currentTrack;
    const upcoming = queue.tracks;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎶 Antrean Musik SpotBot')
      .setDescription(
        current
          ? `**Sedang Diputar:**\n▶️ [${current.title}](${current.url}) | \`${current.duration}\` (Diminta oleh: ${current.requestedBy ?? 'AI'})`
          : '*Tidak ada lagu yang sedang diputar*'
      );

    if (upcoming.length > 0) {
      const trackList = upcoming
        .slice(0, 10)
        .map(
          (t, i) =>
            `\`${i + 1}.\` [${t.title}](${t.url}) | \`${t.duration}\` (oleh: ${t.requestedBy ?? 'User'})`
        )
        .join('\n');

      const remaining = upcoming.length > 10 ? `\n*...dan ${upcoming.length - 10} lagu lainnya.*` : '';
      embed.addFields({
        name: `📑 Lagu Berikutnya (${upcoming.length} lagu):`,
        value: trackList + remaining,
      });
    } else {
      embed.addFields({
        name: '📑 Lagu Berikutnya:',
        value: queue.isAutoplay
          ? '✨ *Antrean kosong — bot akan otomatis memutar lagu berikutnya yang selaras (Autoplay Radio).*'
          : '*Antrean kosong.*',
      });
    }

    embed.setFooter({
      text: `Autoplay Lagu Selaras: ${queue.isAutoplay ? '🟢 Aktif' : '⚪ Nonaktif'} (Gunakan /autoplay untuk mengubah)`,
    });
    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
