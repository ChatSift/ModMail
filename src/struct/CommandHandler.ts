import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { REST } from '@discordjs/rest';
import { AutocompleteInteraction, CommandInteraction, MessageComponentInteraction, Routes } from 'discord.js';
import { container, singleton } from 'tsyringe';
import type { Command, CommandConstructor } from '#struct/Command';
import { Component, ComponentConstructor, getComponentInfo } from '#struct/Component';
import { Env } from '#struct/Env';

@singleton()
export class CommandHandler {
	private readonly commands = new Map<string, Command>();
	private readonly components = new Map<string, Component>();

	public constructor(private readonly env: Env) {}

	// TODO(DD): Error handling
	public async handleAutocomplete(interaction: AutocompleteInteraction<'cached'>) {
		const command = this.commands.get(interaction.commandName);
		if (!command?.handleAutocomplete) {
			return interaction.respond([]);
		}

		const options = await command.handleAutocomplete(interaction);
		return interaction.respond(options.slice(0, 25));
	}

	public handleMessageComponent(interaction: MessageComponentInteraction<'cached'>) {
		const [name, ...args] = interaction.customId.split('|') as [string, ...string[]];
		const component = this.components.get(name);
		return component?.handle(interaction, ...args);
	}

	public handleCommand(interaction: CommandInteraction<'cached'>) {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			return;
		}

		// @ts-expect-error - Yet another instance of odd union behavior. Unsure if there's a way to avoid this
		return command.handle(interaction);
	}

	public init(): Promise<void[]> {
		return Promise.all([this.registerCommands(), this.registerComponents()]);
	}

	public async registerDevInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);

		const promises: Promise<unknown>[] = [];
		for (const guildId of this.env.testGuildIds ?? []) {
			promises.push(
				api.put(Routes.applicationGuildCommands(this.env.discordClientId, guildId), {
					body: options,
				}),
			);
		}

		await Promise.all(promises);
	}

	public async registerProdInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);
		await api.put(Routes.applicationCommands(this.env.discordClientId), { body: options });
	}

	private async registerCommands(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'commands');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const mod = (await import(file)) as { default: CommandConstructor };
			const command = container.resolve(mod.default);

			this.commands.set(command.interactionOptions.name, command);
		}
	}

	private async registerComponents(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'components');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const info = getComponentInfo(file);
			if (!info) {
				continue;
			}

			const mod = (await import(file)) as { default: ComponentConstructor };
			const component = container.resolve(mod.default);
			const name = component.name ?? info.name;

			this.components.set(name, component);
		}
	}
}
