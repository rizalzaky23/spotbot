import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const pauseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Jeda pemutaran musik saat ini'),

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
        content: '❌ Kamu harus berada di voice channel untuk menjeda lagu!',
        ephemeral: true,
      });
      return;
    }

    const queueManager = QueueManager.getInstance();
    const success = queueManager.pause(interaction.guild.id);

    if (success) {
      await interaction.reply({ content: '⏸️ Pemutaran musik berhasil dijeda.' });
    } else {
      await interaction.reply({
        content: '⚠️ Tidak ada audio aktif yang dapat dijeda.',
        ephemeral: true,
      });
    }
  },
};
