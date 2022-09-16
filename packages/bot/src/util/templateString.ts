import { time } from "@discordjs/builders";
import type { GuildMember } from "discord.js";
import { TimestampStyles } from "discord.js";
import { getSortedMemberRolesString } from "#util/getSortedMemberRoles";

export type TemplateData = {
	guildName: string;
	joinDate: string;
	roles: string;
	userId: string;
	username: string;
};

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
	return content.replace(/{{ (?<template>\w+?) }}/gm, (_, template: string) => Object.hasOwn(data, template) ? data[template as keyof TemplateData] : `[unknown template ${template}]`);
}
