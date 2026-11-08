import { Collection } from 'discord.js';
import { Command } from './types.js';
import { connectCommand } from './connect.js';
import { disconnectCommand } from './disconnect.js';
import { statusCommand } from './status.js';
import { playCommand } from './play.js';
import { skipCommand } from './skip.js';
import { queueCommand } from './queue.js';
import { pauseCommand } from './pause.js';
import { resumeCommand } from './resume.js';
import { stopCommand } from './stop.js';
import { autoplayCommand } from './autoplay.js';

export const commands = new Collection<string, Command>();

commands.set(connectCommand.data.name, connectCommand);
commands.set(disconnectCommand.data.name, disconnectCommand);
commands.set(statusCommand.data.name, statusCommand);
commands.set(playCommand.data.name, playCommand);
commands.set(skipCommand.data.name, skipCommand);
commands.set(queueCommand.data.name, queueCommand);
commands.set(pauseCommand.data.name, pauseCommand);
commands.set(resumeCommand.data.name, resumeCommand);
commands.set(stopCommand.data.name, stopCommand);
commands.set(autoplayCommand.data.name, autoplayCommand);

export { Command };
