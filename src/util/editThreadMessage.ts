import { EmbedBuilder } from '@discordjs/builders';
import { PrismaClient, ThreadMessage } from '@prisma/client';
import { Attachment, ChatInputCommandInteraction, Client, GuildMember, ThreadChannel } from 'discord.js';
import { container } from 'tsyringe';

export interface EditThreadMessageOptions {
	threadMessage: ThreadMessage;
	content: string;
	attachment?: Attachment | null;
	member: GuildMember;
	interaction?: ChatInputCommandInteraction<'cached'>;
}

export async function editThreadMessage({
	threadMessage,
	content,
	attachment,
	member,
	interaction,
}: EditThreadMessageOptions) {
	const prisma = container.resolve(PrismaClient);
	const client = container.resolve(Client);

	const embed = new EmbedBuilder().setDescription(content).setImage(attachment?.url ?? null);

	if (threadMessage.staffId) {
		const dmChannel = await member.user.createDM();
		const userMessage = await dmChannel.messages.fetch({ message: threadMessage.userMessageId, force: true });
		await userMessage.edit({ embeds: [{ ...userMessage.embeds[0]?.toJSON(), ...embed.toJSON() }] });

		if (interaction) {
			await interaction.reply({ content: 'Successfully edited your reply', ephemeral: true });
			setTimeout(() => void interaction.deleteReply().catch(() => null), 2_500);
		}
	}

	const modmailThread = await prisma.thread.findFirst({
		where: { threadId: threadMessage.threadId },
		rejectOnNotFound: true,
	});

	const channel = (await client.channels.fetch(modmailThread.channelId)) as ThreadChannel;
	const message = await channel.messages.fetch({ message: threadMessage.guildMessageId, force: true });
	const oldContent = message.embeds[0]?.description;
	await message.edit({ embeds: [{ ...message.embeds[0]?.toJSON(), ...embed.toJSON() }] });

	if (!interaction) {
		await channel.send(
			`User edited their message: <${message.url}>.${oldContent ? ` Old content: ${oldContent}` : ''}`,
		);
	}
}
