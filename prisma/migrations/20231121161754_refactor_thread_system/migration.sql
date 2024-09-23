-- CreateTable
CREATE TABLE "Threadv2" (
    "threadId" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "promptChannelId" TEXT NOT NULL,
    "promptMessageId" TEXT NOT NULL,
    "userEndThreadId" TEXT NOT NULL,
    "modForumId" TEXT NOT NULL,
    "modEndThreadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Threadv2_pkey" PRIMARY KEY ("threadId")
);
