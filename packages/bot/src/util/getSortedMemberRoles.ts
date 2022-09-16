import type { GuildMember } from "discord.js";

export function getSortedMemberRolesString(member: GuildMember): string {
	if (member.roles.cache.size <= 1) {
		return "none";
	}

	return member.roles.cache
		.filter((role) => role.id !== member.guild.id)
		.sort((a, b) => b.position - a.position)
		.map((role) => role.toString())
		.join(", ");
}
