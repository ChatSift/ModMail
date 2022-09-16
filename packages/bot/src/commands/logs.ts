import type { Thread } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import type { ButtonBuilder } from "discord.js";
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	Colors,
	EmbedBuilder,
	hyperlink,
	inlineCode,
	time,
	TimestampStyles,
	type ChatInputCommandInteraction,
} from "discord.js";
import i18next from "i18next";
import { singleton } from "tsyringe";
import { getLocalizedProp, type CommandBody, type Command } from "#struct/Command";
import type { SelectMenuPaginatorConsumers } from "#struct/SelectMenuPaginator";
import { SelectMenuPaginator } from "#struct/SelectMenuPaginator";

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp("name", "commands.logs.name"),
		...getLocalizedProp("description", "commands.logs.description"),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				...getLocalizedProp("name", "commands.logs.options.user.name"),
				...getLocalizedProp("description", "commands.logs.options.user.description"),
				type: ApplicationCommandOptionType.User,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<"cached">) {
		let user = interaction.options.getUser("user");

		if (!user) {
			const thread = await this.prisma.thread.findFirst({
				where: {
					channelId: interaction.channelId,
					closedById: null,
				},
			});
			if (!thread) {
				return interaction.reply(i18next.t("common.errors.no_thread", { lng: interaction.locale }));
			}

			user = await this.client.users.fetch(thread.userId).catch(() => null);
		}

		if (!user) {
			return interaction.reply(i18next.t("common.errors.user_deleted", { lng: interaction.locale }));
		}

		const threads = await this.prisma.thread.findMany({ where: { userId: user.id } });
		if (!threads.length) {
			return interaction.reply(i18next.t("common.errors.no_resources", {
				resource: "logs",
				lng: interaction.locale,
			}));
		}

		const paginator = new SelectMenuPaginator({
			key: "logs",
			data: threads,
			maxPageLength: 40,
		});

		const embed = new EmbedBuilder()
			.setTitle(
				i18next.t("commands.logs.embed.title", { lng: interaction.locale }),
			)
			.setColor(Colors.Blurple);

		const actionRow = new ActionRowBuilder<ButtonBuilder>();

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Thread[]>) => {
			const { data, pageLeftButton, pageRightButton } = consumers.asButtons();
			embed.setDescription(
				data
					.map(
						(thread) => `• ${inlineCode(thread.threadId.toString())} ${time(
							Math.round(thread.createdAt.getTime() / 1_000),
							TimestampStyles.ShortDate,
						)}: ${hyperlink("Jump", `https://discordapp.com/channels/${interaction.guildId}/${thread.channelId}/0`)}`,
					)
					.join("\n"),
			);
			actionRow.setComponents([pageLeftButton, pageRightButton]);
		};

		updateMessagePayload(paginator.getCurrentPage());

		const reply = await interaction.reply({
			embeds: [embed],
			components: [actionRow],
			fetchReply: true,
		});

		for await (const [component] of reply.createMessageComponentCollector({ idle: 30_000 })) {
			const isLeft = component.customId === "page-left";
			updateMessagePayload(isLeft ? paginator.previousPage() : paginator.nextPage());
			await component.update({
				embeds: [embed],
				components: [actionRow],
			});
		}

		return reply.edit({ components: [] });
	}
}
