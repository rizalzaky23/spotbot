import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SessionManager } from '../sessionManager.js';

export const disconnectCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Stops the Spotify receiver, kills the audio process, and leaves voice'),

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
      await interaction.reply({
        content: '⚠️ The bot is not currently connected to any voice channel in this server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const channelName = session.channelName;
      await sessionManager.destroySession(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor(0xe0245e)
        .setTitle('🔴 Disconnected')
        .setDescription(
          `Left voice channel **#${channelName}** and terminated the Spotify Connect receiver.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Command: disconnect] Error:', error);
      await interaction.editReply({
        content: `❌ Error disconnecting: ${(error as Error).message}`,
      });
    }
  },
};
