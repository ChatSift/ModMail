import { EmbedBuilder } from '@discordjs/builders';
import { Colors, GuildMember, Message, ThreadChannel } from 'discord.js';

export interface SendThreadMessageOptions {
	message: Message;
	member: GuildMember;
	channel: ThreadChannel;
	staff: boolean;
}

export async function sendThreadMessage({ message, member, channel, staff }: SendThreadMessageOptions) {
	const noteable = [];

	if (message.stickers.size) {
		noteable.push('stickers');
	}

	return channel.send({
		content: noteable.length ? `This message also included: ${noteable.join(', ')}` : undefined,
		embeds: [
			new EmbedBuilder()
				.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
				.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
				.setColor(staff ? Colors.Blurple : Colors.Green)
				.setDescription(message.content)
				.setImage(message.attachments.size ? message.attachments.first()!.url : null),
		],
	});
}
