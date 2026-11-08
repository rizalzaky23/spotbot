import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Hentikan pemutaran musik dan bersihkan seluruh antrean lagu'),

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
        content: '❌ Kamu harus berada di voice channel untuk menghentikan musik!',
        ephemeral: true,
      });
      return;
    }

    const queueManager = QueueManager.getInstance();
    queueManager.stop(interaction.guild.id);

    await interaction.reply({
      content: '⏹️ Pemutaran musik dihentikan dan seluruh antrean telah dibersihkan.',
    });
  },
};
