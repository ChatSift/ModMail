// !!! PLEASE READ !!!
// This file's content is snatched straight out of our generated @prisma/client
// It's here because we need it for Routes to use types that DON'T rely on prisma
// Because otherwise we would need to somehow share our prisma.schema (and 2 others) with the frontend
// Which would NOT work. Absolutely make sure to use the types below and to cast away any types from @prsisma/client

export interface GuildSettings {
	guildId: string;
	modmailChannelId: string | null;
	greetingMessage: string | null;
	farewellMessage: string | null;
	simpleMode: boolean;
	alertRoleId: string | null;
}

export interface SnippetUpdates {
	snippetUpdateId: number;
	snippetId: number;
	updatedAt: Date;
	updatedBy: string;
	oldContent: string;
}

export interface Snippet {
	snippetId: number;
	guildId: string;
	commandId: string;
	createdById: string;
	name: string;
	content: string;
	timesUsed: number;
	lastUsedAt: Date | null;
	createdAt: Date;
	lastUpdatedAt: Date;
}

export interface ScheduledThreadClose {
	threadId: number;
	scheduledById: string;
	silent: boolean;
	closeAt: Date;
}

export interface ThreadMessage {
	threadMessageId: number;
	localThreadMessageId: number;
	guildId: string;
	threadId: number;
	userId: string;
	userMessageId: string;
	staffId: string | null;
	guildMessageId: string;
	anon: boolean;
}

export interface Thread {
	threadId: number;
	guildId: string;
	channelId: string;
	userId: string;
	createdById: string;
	createdAt: Date;
	closedById: string | null;
	closedAt: Date | null;
	lastLocalThreadMessageId: number;
}

export interface Block {
	userId: string;
	guildId: string;
	expiresAt: Date | null;
}

export interface ThreadOpenAlert {
	guildId: string;
	userId: string;
}

export interface ThreadReplyAlert {
	threadId: number;
	userId: string;
}
