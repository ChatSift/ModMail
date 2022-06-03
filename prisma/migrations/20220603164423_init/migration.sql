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

-- CreateIndex
CREATE UNIQUE INDEX "Snippet_guildId_name_key" ON "Snippet"("guildId", "name");

-- AddForeignKey
ALTER TABLE "SnippetUpdates" ADD CONSTRAINT "SnippetUpdates_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet"("snippetId") ON DELETE CASCADE ON UPDATE CASCADE;
