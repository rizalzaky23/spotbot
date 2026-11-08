import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { QueueManager } from '../queueManager.js';

export const resumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Lanjutkan pemutaran musik yang sedang dijeda'),

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
        content: '❌ Kamu harus berada di voice channel untuk melanjutkan lagu!',
        ephemeral: true,
      });
      return;
    }

    const queueManager = QueueManager.getInstance();
    const success = queueManager.resume(interaction.guild.id);

    if (success) {
      await interaction.reply({ content: '▶️ Pemutaran musik dilanjutkan.' });
    } else {
      await interaction.reply({
        content: '⚠️ Tidak ada audio yang sedang dijeda.',
        ephemeral: true,
      });
    }
  },
};
