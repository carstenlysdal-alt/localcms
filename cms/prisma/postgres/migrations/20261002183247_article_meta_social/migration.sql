-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "planlagtTid" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ArticleMeta" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "robotsNoindex" BOOLEAN NOT NULL DEFAULT false,
    "robotsNofollow" BOOLEAN NOT NULL DEFAULT false,
    "keywords" JSONB NOT NULL,
    "newsKeywords" JSONB NOT NULL,
    "ogTitel" TEXT,
    "ogBeskrivelse" TEXT,
    "ogMediaId" TEXT,
    "twitterCard" TEXT,
    "twitterTitel" TEXT,
    "twitterBeskrivelse" TEXT,
    "twitterMediaId" TEXT,
    "social" JSONB NOT NULL,
    "schemaType" TEXT,
    "isAccessibleForFree" BOOLEAN NOT NULL DEFAULT true,
    "paywall" JSONB,
    "dateline" TEXT,
    "standout" BOOLEAN NOT NULL DEFAULT false,
    "laesetidMin" INTEGER,
    "udloebTid" TIMESTAMP(3),
    "begivenhedTid" TIMESTAMP(3),
    "medforfattere" JSONB NOT NULL,
    "kilder" JSONB NOT NULL,
    "sistSubstantielOpdateringTid" TIMESTAMP(3),
    "oversaettelser" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "fraSektion" TEXT NOT NULL,
    "fraSlug" TEXT NOT NULL,
    "tilArticleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleMeta_articleId_key" ON "ArticleMeta"("articleId");

-- CreateIndex
CREATE INDEX "ArticleMeta_instansId_idx" ON "ArticleMeta"("instansId");

-- CreateIndex
CREATE INDEX "SlugRedirect_tilArticleId_idx" ON "SlugRedirect"("tilArticleId");

-- CreateIndex
CREATE UNIQUE INDEX "SlugRedirect_instansId_fraSektion_fraSlug_key" ON "SlugRedirect"("instansId", "fraSektion", "fraSlug");

-- CreateIndex
CREATE INDEX "Article_instansId_status_planlagtTid_idx" ON "Article"("instansId", "status", "planlagtTid");

-- AddForeignKey
ALTER TABLE "ArticleMeta" ADD CONSTRAINT "ArticleMeta_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_tilArticleId_fkey" FOREIGN KEY ("tilArticleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

