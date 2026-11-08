import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Lewati lagu yang sedang diputar ke antrean berikutnya atau lagu selaras'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: '❌ Perintah ini hanya dapat digunakan di dalam server Discord.',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.reply({
        content: '❌ Kamu harus berada di voice channel untuk melewati lagu!',
        ephemeral: true,
      });
      return;
    }

    const queueManager = QueueManager.getInstance();
    const queue = queueManager.getQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack || !queue.isPlaying) {
      await interaction.reply({
        content: '⚠️ Tidak ada lagu yang sedang diputar saat ini.',
        ephemeral: true,
      });
      return;
    }

    const skipped = await queueManager.skip(interaction.guild.id);
    if (skipped) {
      await interaction.reply({
        content: `⏭️ **Melewati:** [${skipped.title}](${skipped.url})\n*Mempersiapkan lagu berikutnya...*`,
      });
    } else {
      await interaction.reply({
        content: '⚠️ Gagal melewati lagu.',
        ephemeral: true,
      });
    }
  },
};
