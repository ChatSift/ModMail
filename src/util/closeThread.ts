import { EmbedBuilder } from '@discordjs/builders';
import { PrismaClient, Thread } from '@prisma/client';
import { Client, Colors, ThreadChannel } from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';

export interface CloseThreadOptions {
	thread: Thread;
	channel: ThreadChannel;
	silent: boolean;
}

export async function closeThread({ thread, channel, silent }: CloseThreadOptions) {
	const prisma = container.resolve(PrismaClient);
	const client = container.resolve<Client<true>>(Client);

	if (!silent) {
		const settings = await prisma.guildSettings.findFirst({ where: { guildId: thread.guildId } });
		const farewellEmbed = new EmbedBuilder()
			.setAuthor({
				name: i18next.t('thread.farewell.embed.author'),
				iconURL: client.user.displayAvatarURL(),
			})
			.setDescription(
				settings?.farewellMessage ??
					'This thread has been closed. You can start a new one in the future by sending another message here.',
			)
			.setColor(Colors.NotQuiteBlack);

		if (!settings?.farewellMessage) {
			farewellEmbed.setFooter({
				text: "Note: The above wasn't set to the user as you do not have a farewell message set. It is merely a placeholder",
			});
		}

		await channel.send({ embeds: [farewellEmbed] });

		if (settings?.farewellMessage) {
			const member = await channel.guild.members.fetch(thread.userId).catch(() => null);
			if (member) {
				try {
					await member.send({ embeds: [farewellEmbed] });
				} catch {
					return channel.send(i18next.t('common.errors.dm_fail'));
				}
			}
		}
	}

	await channel.send({ content: i18next.t('common.success.archived') });
	await channel.setArchived(true);
}
