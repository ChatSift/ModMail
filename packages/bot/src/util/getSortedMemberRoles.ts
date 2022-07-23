import type { GuildMember } from 'discord.js';

export function getSortedMemberRolesString(member: GuildMember): string {
	if (member.roles.cache.size <= 1) {
		return 'none';
	}

	return member.roles.cache
		.filter((r) => r.id !== member.guild.id)
		.sort((a, b) => b.position - a.position)
		.map((r) => r.toString())
		.join(', ');
}
