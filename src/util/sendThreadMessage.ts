import { EmbedBuilder } from '@discordjs/builders';
import {
	Attachment,
	ChatInputCommandInteraction,
	Collection,
	Colors,
	GuildMember,
	Sticker,
	ThreadChannel,
} from 'discord.js';
import i18next from 'i18next';

export interface SendThreadMessageOptions {
	content: string;
	stickers?: Collection<string, Sticker> | null;
	attachment?: Attachment | null;
	member: GuildMember;
	channel: ThreadChannel;
	staff: boolean;
	interaction?: ChatInputCommandInteraction<'cached'>;
}

export async function sendThreadMessage({
	content,
	stickers,
	attachment,
	member,
	channel,
	staff,
	interaction,
}: SendThreadMessageOptions) {
	const noteable = [];

	if (stickers?.size) {
		noteable.push('stickers');
	}

	const embed = new EmbedBuilder()
		.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
		.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
		.setColor(staff ? Colors.Blurple : Colors.Green)
		.setDescription(content)
		.setImage(attachment?.url ?? null);

	if (staff) {
		try {
			await member.send({ embeds: [embed] });
		} catch {
			return channel.send(i18next.t('common.errors.dm_fail'));
		}
	}

	const options = {
		content: noteable.length ? `This message also included: ${noteable.join(', ')}` : undefined,
		embeds: [embed],
	};

	if (interaction) {
		return interaction.reply(options);
	}

	return channel.send(options);
}
