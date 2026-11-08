import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const autoplayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Aktifkan atau nonaktifkan pemutaran otomatis lagu selaras (Radio AI)')
    .addBooleanOption((option) =>
      option
        .setName('status')
        .setDescription('Pilih True untuk aktif, False untuk nonaktif (biarkan kosong untuk toggle)')
        .setRequired(false)
    ),

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

    const explicitStatus = interaction.options.getBoolean('status');
    const newStatus =
      explicitStatus !== null ? explicitStatus : queue ? !queue.isAutoplay : true;

    if (queue) {
      queueManager.setAutoplay(interaction.guild.id, newStatus);
    }

    if (newStatus) {
      await interaction.reply({
        content:
          '✨ **Autoplay Lagu Selaras: DIAKTIFKAN**\nBot akan secara otomatis mencarikan lagu berikutnya yang berirama, bergenre, dan selaras dengan lagu saat ini begitu antrean kosong.',
      });
    } else {
      await interaction.reply({
        content:
          '⚪ **Autoplay Lagu Selaras: DINONAKTIFKAN**\nBot akan berhenti memutar lagu ketika antrean manual telah selesai.',
      });
    }
  },
};
