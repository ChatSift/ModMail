/*
  Warnings:

  - A unique constraint covering the columns `[threadId,localThreadMessageId]` on the table `ThreadMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ThreadMessage_guildId_localThreadMessageId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ThreadMessage_threadId_localThreadMessageId_key" ON "ThreadMessage"("threadId", "localThreadMessageId");
