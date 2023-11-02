import type { GuildMember } from 'discord.js';
import { TimestampStyles, time } from 'discord.js';
import { getSortedMemberRolesString } from '#util/getSortedMemberRoles';

export interface TemplateData {
	guildName: string;
	joinDate: string;
	roles: string;
	userId: string;
	username: string;
}

export function templateDataFromMember(member: GuildMember): TemplateData {
	return {
		username: member.user.username,
		userId: member.user.id,
		joinDate: time(member.joinedAt!, TimestampStyles.LongDate),
		roles: getSortedMemberRolesString(member),
		guildName: member.guild.name,
	};
}

export function templateString(content: string, data: TemplateData) {
	return content.replaceAll(/{{ (?<template>\w+?) }}/gm, (_, template: string) =>
		Object.hasOwn(data, template) ? data[template as keyof TemplateData] : `[unknown template ${template}]`,
	);
}
