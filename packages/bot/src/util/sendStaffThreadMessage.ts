import { EmbedBuilder, bold, inlineCode } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import {
	Attachment,
	Colors,
	GuildMember,
	ChatInputCommandInteraction,
	MessageEditOptions,
	MessageOptions,
	ThreadChannel,
	Message,
	MessageContextMenuCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { logger } from './logger';
import { templateDataFromMember, templateString } from '#util/templateString';

export interface SendStaffThreadMessageOptions {
	content: string;
	attachment?: Attachment | null;
	staff: GuildMember;
	member: GuildMember;
	channel: ThreadChannel;
	threadId: number;
	simpleMode: boolean;
	anon: boolean;
	interaction?: ChatInputCommandInteraction<'cached'> | MessageContextMenuCommandInteraction<'cached'>;
	existing?: { user: Message; guild: Message; replyId: number };
}

export async function sendStaffThreadMessage({
	content,
	attachment,
	staff,
	member,
	channel,
	threadId,
	simpleMode,
	anon,
	interaction,
	existing,
}: SendStaffThreadMessageOptions) {
	const prisma = container.resolve(PrismaClient);
	content = templateString(content, templateDataFromMember(member));

	const options: Omit<MessageOptions, 'flags'> = {
		allowedMentions: { roles: [] },
	};
	if (simpleMode) {
		options.content = `${bold(
			`${existing ? `${inlineCode(existing.replyId.toString())} ` : ''}${anon ? '(Anonymous) ' : ''}(${
				staff.guild.name
			} Team) ${staff.user.tag}:`,
		)} ${content}`;
		if (attachment) {
			options.files = [attachment];
		} else {
			options.files = [];
			options.attachments = [];
		}
	} else {
		const embed = new EmbedBuilder()
			.setColor(Colors.Blurple)
			.setDescription(content)
			.setImage(attachment?.url ?? null)
			.setFooter({
				text: `${existing ? `Reply ID: ${existing.replyId} | ` : ''}${staff.user.tag} (${staff.user.id})`,
				iconURL: staff.user.displayAvatarURL(),
			});

		if (anon) {
			embed.setAuthor({ name: `${staff.guild.name} Team`, iconURL: staff.guild.iconURL() ?? undefined });
		}
		if (staff.nickname && !anon) {
			embed.setAuthor({ name: staff.displayName, iconURL: staff.displayAvatarURL() });
		}

		options.embeds = [embed];
	}

	const userOptions = { ...options };
	// Now that we've sent the message locally, we can purge all identifying information from anon messages
	if (anon) {
		if (simpleMode) {
			userOptions.content = `${bold(
				`${existing ? `${inlineCode(existing.replyId.toString())} ` : ''}(Anonymous) ${staff.guild.name} Team:`,
			)} ${content}`;
		} else {
			const [embed] = userOptions.embeds as [EmbedBuilder];
			const newEmbed = new EmbedBuilder(embed.toJSON());
			newEmbed.setFooter({
				text: `${existing ? `Reply ID: ${existing.replyId} | ` : ''}(Anonymous)`,
			});
			userOptions.embeds = [embed];
		}
	}

	if (existing) {
		await interaction?.reply({ content: 'Successfully edited your message' });
		setTimeout(
			() => void interaction?.deleteReply().catch((e) => logger.error(e, 'Bad interaction.deleteReply()')),
			1_500,
		);
		await existing.guild.edit(options);
		return existing.user.edit(userOptions);
	}

	const guildMessage = await channel.send(options);
	await interaction?.reply({ content: 'Successfully posted your message' });
	setTimeout(
		() => void interaction?.deleteReply().catch((e) => logger.error(e, 'Bad interaction.deleteReply()')),
		1_500,
	);

	let userMessage: Message;
	try {
		userMessage = await member.send(userOptions);
	} catch {
		return channel.send(i18next.t('common.errors.dm_fail'));
	}

	const { lastLocalThreadMessageId: localThreadMessageId } = await prisma.thread.update({
		data: {
			lastLocalThreadMessageId: { increment: 1 },
		},
		where: { threadId },
	});

	const threadMessage = await prisma.threadMessage.create({
		data: {
			guildId: member.guild.id,
			localThreadMessageId,
			threadId,
			userId: member.user.id,
			userMessageId: userMessage.id,
			guildMessageId: guildMessage.id,
			staffId: staff.user.id,
			anon,
		},
	});

	// Edit the reply ID in
	if (simpleMode) {
		options.content = `${inlineCode(threadMessage.localThreadMessageId.toString())} ${options.content!}`;
	} else {
		const [embed] = options.embeds as [EmbedBuilder];
		embed.setFooter({
			text: `Reply ID: ${threadMessage.localThreadMessageId} | ${staff.user.tag} (${staff.user.id})`,
			iconURL: staff.user.displayAvatarURL(),
		});
		options.embeds = [embed];
	}

	await guildMessage.edit(options as MessageEditOptions);
}
