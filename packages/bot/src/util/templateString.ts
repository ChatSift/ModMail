import { time } from '@discordjs/builders';
import { GuildMember, TimestampStyles } from 'discord.js';
import { getSortedMemberRolesString } from '#util/getSortedMemberRoles';

export interface TemplateData {
	username: string;
	userId: string;
	joinDate: string;
	roles: string;
	guildName: string;
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
	return content.replace(/{{ (?<template>\w+?) }}/gm, (_, template: string) =>
		Object.hasOwn(data, template) ? data[template as keyof TemplateData] : `[unknown template ${template}]`,
	);
}
