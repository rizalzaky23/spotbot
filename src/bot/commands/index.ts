import { Collection } from 'discord.js';
import { Command } from './types.js';
import { connectCommand } from './connect.js';
import { disconnectCommand } from './disconnect.js';
import { statusCommand } from './status.js';

export const commands = new Collection<string, Command>();

commands.set(connectCommand.data.name, connectCommand);
commands.set(disconnectCommand.data.name, disconnectCommand);
commands.set(statusCommand.data.name, statusCommand);

export { Command };
