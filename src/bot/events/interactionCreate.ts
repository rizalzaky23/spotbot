import { Interaction } from 'discord.js';
import { commands } from '../commands/index.js';

export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[Bot] Unknown command requested: /${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Bot] Error executing command /${interaction.commandName}:`, error);

    const errorMessage = '❌ An error occurred while executing this command!';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
