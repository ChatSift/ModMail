import { PrismaClient } from "@prisma/client";
import {
	type APIApplicationCommandSubcommandOption,
	ApplicationCommandOptionType,
	type ChatInputCommandInteraction,
} from "discord.js";
import i18next from "i18next";
import { singleton } from "tsyringe";
import { getLocalizedProp, type Subcommand } from "#struct/Command";
import { CommandHandler } from "#struct/CommandHandler";

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, "type"> = {
		...getLocalizedProp("name", "commands.snippets.add.name"),
		...getLocalizedProp("description", "commands.snippets.add.description"),
		options: [
			{
				...getLocalizedProp("name", "commands.snippets.add.options.name.name"),
				...getLocalizedProp("description", "commands.snippets.add.options.name.description"),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				...getLocalizedProp("name", "commands.snippets.add.options.content.name"),
				...getLocalizedProp("description", "commands.snippets.add.options.content.description"),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly commandHandler: CommandHandler) {}

	public async handle(interaction: ChatInputCommandInteraction<"cached">) {
		const name = interaction.options.getString("name", true);
		const content = interaction.options.getString("content", true);

		if (this.commandHandler.commands.has(name)) {
			return interaction.reply({ content: i18next.t("common.errors.reserved_name", { lng: interaction.locale }) });
		}

		const existing = await this.prisma.snippet.findFirst({
			where: {
				guildId: interaction.guild.id,
				name,
			},
		});
		if (existing) {
			return interaction.reply({
				content: i18next.t("common.errors.resource_exists", {
					resource: "snippet",
					lng: interaction.locale,
				}),
			});
		}

		const list = await this.prisma.snippet.findMany({ where: { guildId: interaction.guild.id } });
		if (list.length >= 50) {
			return interaction.reply({
				content: i18next.t("common.errors.resource_limit_reached", {
					resource: "snippet",
					limit: 50,
					lng: interaction.locale,
				}),
			});
		}

		const maxLen = 1_900;
		if (content.length > maxLen) {
			return interaction.reply({
				content: i18next.t("common.errors.resource_too_long", {
					resource: "snippet",
					length: maxLen,
					lng: interaction.locale,
				}),
			});
		}

		await interaction.deferReply();

		let command;
		try {
			command = await interaction.guild.commands.create({
				name,
				description: i18next.t("snippet_command.description"),
				default_member_permissions: "0",
				dm_permission: false,
				options: [
					{
						...getLocalizedProp("name", "snippet_command.options.anon.name"),
						...getLocalizedProp("description", "snippet_command.options.anon.description"),
						type: ApplicationCommandOptionType.Boolean,
					},
				],
			});
		} catch {
			return interaction.editReply({ content: i18next.t("common.errors.bad_snippet_name", { lng: interaction.locale }) });
		}

		await this.prisma.snippet.create({
			data: {
				guildId: interaction.guildId,
				commandId: command.id,
				createdById: interaction.member.id,
				name,
				content,
			},
		});

		return interaction.editReply({
			content: i18next.t("common.success.resource_creation", {
				resource: "snippet",
				lng: interaction.locale,
			}),
		});
	}
}
