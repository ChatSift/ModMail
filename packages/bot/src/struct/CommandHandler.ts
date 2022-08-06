import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { REST } from '@discordjs/rest';
import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	CommandInteraction,
	inlineCode,
	MessageComponentInteraction,
	RESTPutAPIApplicationCommandsJSONBody,
	Routes,
	ThreadChannel,
} from 'discord.js';
import i18next from 'i18next';
import { container, singleton } from 'tsyringe';
import type { Command, CommandConstructor, CommandWithSubcommands, Subcommand } from '#struct/Command';
import { Component, ComponentConstructor, getComponentInfo } from '#struct/Component';
import { Env } from '#struct/Env';
import { logger } from '#util/logger';
import { sendStaffThreadMessage } from '#util/sendStaffThreadMessage';

@singleton()
export class CommandHandler {
	public readonly commands = new Map<string, Command | CommandWithSubcommands | Subcommand>();
	public readonly components = new Map<string, Component>();

	public constructor(private readonly env: Env, private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(interaction: AutocompleteInteraction) {
		const command = this.commands.get(interaction.commandName) as Command | CommandWithSubcommands | undefined;

		if (!command?.handleAutocomplete && !command?.containsSubcommands) {
			return interaction.respond([]);
		}

		if (command.interactionOptions.dm_permission && interaction.inCachedGuild()) {
			return;
		}

		try {
			const subcmd = interaction.options.getSubcommand(false);
			const handleAutocomplete = subcmd
			? (this.commands.get(`${command.interactionOptions.name}-${subcmd}`)?.handleAutocomplete) ??
				(command.handleAutocomplete!)
			: command.handleAutocomplete!;

			const options = await handleAutocomplete(interaction);
			return await interaction.respond(options.slice(0, 25));
		} catch (err) {
			logger.error({ err, command: interaction.commandName }, 'Error handling autocomplete');
			return interaction.respond([
				{
					name: 'Something went wrong fetching auto complete options. Please report this bug.',
					value: 'noop',
				},
			]);
		}
	}

	public async handleMessageComponent(interaction: MessageComponentInteraction<'cached'>) {
		const [name, ...args] = interaction.customId.split('|') as [string, ...string[]];
		const component = this.components.get(name);

		try {
			// eslint-disable-next-line @typescript-eslint/return-await
			return await component?.handle(interaction, ...args);
		} catch (err) {
			logger.error({ err, component: name }, 'Error handling message component');
			const content = `Something went wrong running component. Please report this bug.\n\n${inlineCode(
				(err as Error).message,
			)}`;

			// Try to display something to the user. We don't actually know what our component has done response wise, though
			await interaction.reply({ content }).catch(() => null);
			await interaction.update({ content }).catch(() => null);
		}
	}

	public async handleCommand(interaction: CommandInteraction) {
		const command = this.commands.get(interaction.commandName) as Command | CommandWithSubcommands | undefined;
		if (!command) {
			if (interaction.isChatInputCommand()) {
				return this.handleSnippetCommand(interaction);
			}

			return logger.warn(interaction, 'Command interaction not registered locally was not chatInput');
		}

		if (!command.interactionOptions.dm_permission && !interaction.inCachedGuild()) {
			return logger.warn(
				{ interaction, command },
				'Command interaction had dm_permission off and was not in cached guild',
			);
		}

		try {
			if (!command.containsSubcommands) {
				// eslint-disable-next-line @typescript-eslint/return-await
				return await command.handle(interaction as ChatInputCommandInteraction<'cached'>);
			}

			if (!interaction.isChatInputCommand()) {
				return logger.warn(interaction, 'Command interaction with subcommand call was not chatInput');
			}

			const subcommand = this.commands.get(`${interaction.commandName}-${interaction.options.getSubcommand()}`) as
				| Subcommand
				| undefined;

			if (!subcommand) {
				return logger.warn(interaction, 'Command interaction with subcommands map had no subcommand');
			}

			// eslint-disable-next-line @typescript-eslint/return-await
			return await subcommand.handle(interaction as ChatInputCommandInteraction<'cached'>);
		} catch (err) {
			// TODO(DD): Consider dealing with specific error
			logger.error({ err, command: interaction.commandName }, 'Error handling command');
			const content = `Something went wrong running command. This could be a bug, or it could be related to your permissions.\n\n${inlineCode(
				(err as Error).message,
			)}`;

			// Try to display something to the user.
			await interaction.reply({ content }).catch(() => null);
		}
	}

	public init(): Promise<void[]> {
		return Promise.all([this.registerCommands(), this.registerComponents()]);
	}

	public async registerInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const commands = [...this.commands.values()];
		const commandsWithoutSubcommandInterface = commands.filter((cmd) => 'containsSubcommands' in cmd) as Array<
			Command | CommandWithSubcommands
		>;

		const normalCommands = commandsWithoutSubcommandInterface
			.filter((cmd) => !cmd.containsSubcommands)
			.map((cmd) => cmd.interactionOptions) as RESTPutAPIApplicationCommandsJSONBody;

		const subcommands = commandsWithoutSubcommandInterface
			.filter((cmd) => cmd.containsSubcommands)
			.map((cmd) => ({
				...cmd.interactionOptions,
				options: [...this.commands.entries()]
					.filter(([key]) => key.startsWith(cmd.interactionOptions.name) && key !== cmd.interactionOptions.name)
					.map(([, cmd]) => ({ ...cmd.interactionOptions, type: ApplicationCommandOptionType.Subcommand })),
			})) as RESTPutAPIApplicationCommandsJSONBody;

		const options: RESTPutAPIApplicationCommandsJSONBody = normalCommands.concat(subcommands);
		await api.put(Routes.applicationCommands(this.env.discordClientId), { body: options });
	}

	private async handleSnippetCommand(interaction: ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			return;
		}

		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const snippet = await this.prisma.snippet.findFirst({
			where: { name: interaction.commandName, guildId: interaction.guild.id },
		});
		if (!snippet) {
			return interaction.reply(
				i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
			);
		}

		const anon = interaction.options.getBoolean('anon');

		const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
		if (!member) {
			return i18next.t('common.errors.no_member', { lng: interaction.locale });
		}

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });

		await sendStaffThreadMessage({
			content: snippet.content,
			staff: interaction.member,
			member,
			channel: interaction.channel as ThreadChannel,
			threadId: thread.threadId,
			simpleMode: settings?.simpleMode ?? false,
			anon: anon ?? false,
			interaction,
		});

		await this.prisma.snippet.update({
			data: { lastUsedAt: new Date(), timesUsed: { increment: 1 } },
			where: { snippetId: snippet.snippetId },
		});
	}

	private async registerCommands(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'commands');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const mod = (await import(pathToFileURL(file).toString())) as { default: CommandConstructor };
			const command = container.resolve(mod.default);

			if (command.containsSubcommands) {
				const subPath = join(
					dirname(fileURLToPath(import.meta.url)),
					'..',
					'subcommands',
					command.interactionOptions.name,
				);
				const subFiles = readdirRecurse(subPath, { fileExtensions: ['js'] });

				for await (const subFile of subFiles) {
					const subMod = (await import(pathToFileURL(subFile).toString())) as {
						default: new (...args: any[]) => Subcommand;
					};
					const subcommand = container.resolve(subMod.default);

					this.commands.set(`${command.interactionOptions.name}-${subcommand.interactionOptions.name}`, subcommand);
				}
			}

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

			const mod = (await import(pathToFileURL(file).toString())) as { default: ComponentConstructor };
			const component = container.resolve(mod.default);
			const name = component.name ?? info.name;

			this.components.set(name, component);
		}
	}
}
