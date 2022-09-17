import { container } from 'tsyringe';
import { CommandHandler } from '#struct/CommandHandler';

export async function deploySlashCommands(): Promise<void> {
	const commandHandler = container.resolve(CommandHandler);
	await commandHandler.init();
	await commandHandler.registerInteractions();
}
