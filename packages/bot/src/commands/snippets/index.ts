import { PrismaClient } from "@prisma/client";
import type { ApplicationCommandType } from "discord.js";
import { PermissionsBitField, type ApplicationCommandOptionChoiceData, type AutocompleteInteraction } from "discord.js";
import { singleton } from "tsyringe";
import type { CommandWithSubcommands } from "#struct/Command";
import { getLocalizedProp, type CommandBody } from "#struct/Command";

@singleton()
export default class implements CommandWithSubcommands {
	public readonly containsSubcommands = true;

	public readonly interactionOptions: Omit<CommandBody<ApplicationCommandType.ChatInput>, "options" | "type"> = {
		...getLocalizedProp("name", "commands.snippets.name"),
		...getLocalizedProp("description", "commands.snippets.description"),
		dm_permission: false,
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(
		interaction: AutocompleteInteraction<"cached">,
	): Promise<ApplicationCommandOptionChoiceData[]> {
		const snippets = await this.prisma.snippet.findMany({ where: { guildId: interaction.guild.id } });

		const input = interaction.options.getFocused();
		return snippets
			.filter((snippet) => snippet.name.includes(input) || snippet.content.includes(input))
			.map((snippet) => ({
				name: snippet.name,
				value: snippet.name,
			}))
			.slice(0, 5);
	}
}
