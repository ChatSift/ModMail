// !!! PLEASE READ !!!
// This file's content is snatched straight out of our generated @prisma/client
// It's here because we need it for Routes to use types that DON'T rely on prisma
// Because otherwise we would need to somehow share our prisma.schema (and 2 others) with the frontend
// Which would NOT work. Absolutely make sure to use the types below and to cast away any types from @prsisma/client

export type GuildSettings = {
	alertRoleId: string | null;
	farewellMessage: string | null;
	greetingMessage: string | null;
	guildId: string;
	modmailChannelId: string | null;
	simpleMode: boolean;
};

export type SnippetUpdates = {
	oldContent: string;
	snippetId: number;
	snippetUpdateId: number;
	updatedAt: Date;
	updatedBy: string;
};

export type Snippet = {
	commandId: string;
	content: string;
	createdAt: Date;
	createdById: string;
	guildId: string;
	lastUpdatedAt: Date;
	lastUsedAt: Date | null;
	name: string;
	snippetId: number;
	timesUsed: number;
};

export type ScheduledThreadClose = {
	closeAt: Date;
	scheduledById: string;
	silent: boolean;
	threadId: number;
};

export type ThreadMessage = {
	anon: boolean;
	guildId: string;
	guildMessageId: string;
	localThreadMessageId: number;
	staffId: string | null;
	threadId: number;
	threadMessageId: number;
	userId: string;
	userMessageId: string;
};

export type Thread = {
	channelId: string;
	closedAt: Date | null;
	closedById: string | null;
	createdAt: Date;
	createdById: string;
	guildId: string;
	lastLocalThreadMessageId: number;
	threadId: number;
	userId: string;
};

export type Block = {
	expiresAt: Date | null;
	guildId: string;
	userId: string;
};

export type ThreadOpenAlert = {
	guildId: string;
	userId: string;
};

export type ThreadReplyAlert = {
	threadId: number;
	userId: string;
};
