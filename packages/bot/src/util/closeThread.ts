import { EmbedBuilder, bold } from "@discordjs/builders";
import type { Thread } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import type { MessageOptions, ThreadChannel } from "discord.js";
import { Colors } from "discord.js";
import i18next from "i18next";
import { container } from "tsyringe";
import { templateDataFromMember, templateString } from "#util/templateString";

export type CloseThreadOptions = {
	channel: ThreadChannel;
	silent: boolean;
	thread: Thread;
};

export async function closeThread({ thread, channel, silent }: CloseThreadOptions) {
	const prisma = container.resolve(PrismaClient);

	if (!silent) {
		const settings = await prisma.guildSettings.findFirst({ where: { guildId: thread.guildId } });
		const member = await channel.guild.members.fetch(thread.userId).catch(() => null);
		const baseFarewellMessage =
			settings?.farewellMessage ??
			"This thread has been closed. You can start a new one in the future by sending another message here.";
		const farewellMessage = member ?
			templateString(baseFarewellMessage, templateDataFromMember(member)) :
			baseFarewellMessage;

		const options: MessageOptions = { allowedMentions: { roles: [] } };
		if (settings?.simpleMode) {
			options.content = `⚙️ ${bold(`${channel.guild.name} Staff:`)} ${farewellMessage}`;
		} else {
			const farewellEmbed = new EmbedBuilder()
				.setAuthor({
					name: i18next.t("thread.farewell.embed.author", { guild: channel.guild.name }),
					iconURL: channel.guild.iconURL() ?? undefined,
				})
				.setDescription(farewellMessage)
				.setColor(Colors.NotQuiteBlack);

			options.embeds = [farewellEmbed];
		}

		await channel.send(options);

		if (member) {
			try {
				await member.send(options);
			} catch {
				await channel.send(i18next.t("common.errors.dm_fail"));
				return;
			}
		}
	}

	await channel.send({ content: i18next.t("common.success.archived") });
	await channel.setArchived(true);
}
