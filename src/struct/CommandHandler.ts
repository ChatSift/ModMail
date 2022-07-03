import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { REST } from '@discordjs/rest';
import { PrismaClient } from '@prisma/client';
import {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	CommandInteraction,
	MessageComponentInteraction,
	Routes,
	ThreadChannel,
} from 'discord.js';
import i18next from 'i18next';
import { container, singleton } from 'tsyringe';
import type { Command, CommandConstructor } from '#struct/Command';
import { Component, ComponentConstructor, getComponentInfo } from '#struct/Component';
import { Env } from '#struct/Env';
import { sendStaffThreadMessage } from '#util/sendStaffThreadMessage';

@singleton()
export class CommandHandler {
	public readonly commands = new Map<string, Command>();
	public readonly components = new Map<string, Component>();

	public constructor(private readonly env: Env, private readonly prisma: PrismaClient) {}

	// TODO(DD): Error handling
	public async handleAutocomplete(interaction: AutocompleteInteraction) {
		const command = this.commands.get(interaction.commandName);
		if (!command?.handleAutocomplete) {
			return interaction.respond([]);
		}

		if (command.interactionOptions.dm_permission && interaction.inCachedGuild()) {
			return;
		}

		const options = await command.handleAutocomplete(interaction);
		return interaction.respond(options.slice(0, 25));
	}

	public handleMessageComponent(interaction: MessageComponentInteraction<'cached'>) {
		const [name, ...args] = interaction.customId.split('|') as [string, ...string[]];
		const component = this.components.get(name);
		return component?.handle(interaction, ...args);
	}

	public handleCommand(interaction: CommandInteraction) {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			if (interaction.isChatInputCommand()) {
				return this.handleSnippetCommand(interaction);
			}

			return;
		}

		if (!command.interactionOptions.dm_permission && !interaction.inCachedGuild()) {
			return;
		}

		// @ts-expect-error - Yet another instance of odd union behavior. Unsure if there's a way to avoid this
		return command.handle(interaction);
	}

	public init(): Promise<void[]> {
		return Promise.all([this.registerCommands(), this.registerComponents()]);
	}

	public async registerInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);
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

		return sendStaffThreadMessage({
			content: snippet.content,
			staff: interaction.member,
			member,
			channel: interaction.channel as ThreadChannel,
			threadId: thread.threadId,
			simpleMode: settings?.simpleMode ?? false,
			anon: anon ?? false,
			interaction,
		});
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
