import { container } from 'tsyringe';
import { CommandHandler } from './struct/CommandHandler';
import { Env } from './struct/Env';

export async function deploySlashCommands(): Promise<void> {
	const env = container.resolve(Env);
	const commandHandler = container.resolve(CommandHandler);

	if (env.isProd) {
		await commandHandler.registerProdInteractions();
	} else {
		await commandHandler.registerDevInteractions();
	}
}
