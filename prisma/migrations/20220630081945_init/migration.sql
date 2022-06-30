-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL,
    "modmailChannelId" TEXT,
    "greetingMessage" TEXT,
    "farewellMessage" TEXT,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "SnippetUpdates" (
    "snippetUpdateId" SERIAL NOT NULL,
    "snippetId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "oldContent" TEXT NOT NULL,

    CONSTRAINT "SnippetUpdates_pkey" PRIMARY KEY ("snippetUpdateId")
);

-- CreateTable
CREATE TABLE "Snippet" (
    "snippetId" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Snippet_pkey" PRIMARY KEY ("snippetId")
);

-- CreateTable
CREATE TABLE "ScheduledThreadClose" (
    "threadId" INTEGER NOT NULL,
    "scheduledById" TEXT NOT NULL,
    "silent" BOOLEAN NOT NULL DEFAULT false,
    "closeAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledThreadClose_pkey" PRIMARY KEY ("threadId")
);

-- CreateTable
CREATE TABLE "ThreadMessage" (
    "threadMessageId" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "threadId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "staffId" TEXT,
    "guildMessageId" TEXT NOT NULL,

    CONSTRAINT "ThreadMessage_pkey" PRIMARY KEY ("threadMessageId")
);

-- CreateTable
CREATE TABLE "Thread" (
    "threadId" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "closedAt" TIMESTAMPTZ,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("threadId")
);

-- CreateTable
CREATE TABLE "Block" (
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Block_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateTable
CREATE TABLE "ThreadOpenAlert" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ThreadOpenAlert_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateTable
CREATE TABLE "ThreadReplyAlert" (
    "threadId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ThreadReplyAlert_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Snippet_guildId_name_key" ON "Snippet"("guildId", "name");

-- AddForeignKey
ALTER TABLE "SnippetUpdates" ADD CONSTRAINT "SnippetUpdates_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet"("snippetId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledThreadClose" ADD CONSTRAINT "ScheduledThreadClose_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("threadId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("threadId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadReplyAlert" ADD CONSTRAINT "ThreadReplyAlert_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("threadId") ON DELETE CASCADE ON UPDATE CASCADE;
