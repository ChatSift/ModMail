import { PrismaClient } from "@prisma/client";
import type { ChatInputCommandInteraction, ThreadChannel } from "discord.js";
import i18next from "i18next";
import { container } from "tsyringe";
import { sendStaffThreadMessage, type SendStaffThreadMessageOptions } from "./sendStaffThreadMessage";

// eslint-disable-next-line no-shadow
export enum HandleStaffThreadMessageAction {
	Reply,
	Edit,
}

/**
 *
 * @param interaction - A received interaction from the edit and reply commands.
 * @param action - Which command was used to call this function.
 */
export async function handleStaffThreadMessage(
	interaction: ChatInputCommandInteraction<"cached">,
	action: HandleStaffThreadMessageAction,
) {
	const prisma = container.resolve(PrismaClient);

	const thread = await prisma.thread.findFirst({
		where: {
			channelId: interaction.channelId,
			closedById: null,
		},
	});
	if (!thread) {
		return interaction.reply(i18next.t("common.errors.no_thread"));
	}

	let options: Partial<SendStaffThreadMessageOptions> = {
		content: interaction.options.getString("content", true),
		staff: interaction.member,
		channel: interaction.channel as ThreadChannel,
		interaction,
		threadId: thread.threadId,
	};

	const attachment = interaction.options.getAttachment("attachment");

	const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
	if (!member) {
		return interaction.reply(i18next.t("common.errors.no_member", { lng: interaction.locale }));
	}

	options.member = member;

	if (action === HandleStaffThreadMessageAction.Reply) {
		options.anon = interaction.options.getBoolean("anon") ?? false;
		options.attachment = attachment;
	} else {
		const id = interaction.options.getInteger("id", true);
		const threadMessage = await prisma.threadMessage.findFirst({
			where: {
				thread,
				localThreadMessageId: id,
			},
		});
		if (!threadMessage) {
			return interaction.reply(
				i18next.t("common.errors.resource_not_found", {
					resource: "message",
					lng: interaction.locale,
				}),
			);
		}

		if (threadMessage.staffId !== interaction.user.id) {
			return interaction.reply(i18next.t("common.errors.not_own_message", { lng: interaction.locale }));
		}

		const clearAttachment = interaction.options.getBoolean("clear-attachment");

		if (attachment && clearAttachment) {
			return interaction.reply(
				i18next.t("common.errors.arg_conflict", {
					first: "attachment",
					second: "clear-attachment",
					lng: interaction.locale,
				}),
			);
		}

		const guildMessage = await interaction.channel!.messages.fetch(threadMessage.guildMessageId);
		const userChannel = await member.createDM();
		const userMessage = await userChannel.messages.fetch(threadMessage.userMessageId);

		options = {
			...options,
			attachment,
			anon: threadMessage.anon,
			existing: {
				guild: guildMessage,
				user: userMessage,
				replyId: threadMessage.localThreadMessageId,
			},
		};
	}

	const settings = await prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
	options.simpleMode = settings?.simpleMode ?? false;

	return sendStaffThreadMessage(options as SendStaffThreadMessageOptions);
}
