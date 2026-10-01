-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "domaene" TEXT NOT NULL,
    "logoUrl" TEXT,
    "farver" JSONB,
    "typografi" JSONB,
    "geografiskDækning" JSONB NOT NULL,
    "kategoriTaksonomi" JSONB NOT NULL,
    "sprog" TEXT NOT NULL DEFAULT 'da',
    "markingTekster" JSONB NOT NULL,
    "kvoteloftProcent" INTEGER NOT NULL DEFAULT 25,
    "sideTekster" JSONB,
    "netvaerk" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "slug" TEXT,
    "forfatterType" TEXT NOT NULL DEFAULT 'Freelance',
    "bio" TEXT,
    "profilbilledeUrl" TEXT,
    "kontakt" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortering" INTEGER NOT NULL DEFAULT 0,
    "beskrivelse" TEXT,
    "iNavigation" BOOLEAN NOT NULL DEFAULT true,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "slug" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoTag" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "manchet" TEXT,
    "slug" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Idé',
    "indholdstype" TEXT NOT NULL DEFAULT 'Uafhængig',
    "aiBrug" JSONB NOT NULL,
    "marking" JSONB,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "breaking" BOOLEAN NOT NULL DEFAULT false,
    "seoTitel" TEXT,
    "seoBeskrivelse" TEXT,
    "sprog" TEXT NOT NULL DEFAULT 'da',
    "publiceretTid" TIMESTAMP(3),
    "opdateretTid" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kategoriId" TEXT,
    "forfatterId" TEXT,
    "instansId" TEXT NOT NULL,
    "supportAftaleId" TEXT,
    "coverMediaId" TEXT,
    "externalId" TEXT,
    "provenance" JSONB,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "filtype" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filnavn" TEXT,
    "mimeType" TEXT,
    "stoerrelse" INTEGER,
    "bredde" INTEGER,
    "hoejde" INTEGER,
    "altTekst" TEXT,
    "billedtekst" TEXT,
    "ophavsperson" TEXT,
    "rettighedsstatus" TEXT,
    "licensType" TEXT,
    "rettighedsUdlob" TIMESTAMP(3),
    "kildeType" TEXT NOT NULL DEFAULT 'Ekstern',
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAgreement" (
    "id" TEXT NOT NULL,
    "organisationNavn" TEXT NOT NULL,
    "pakkeNiveau" TEXT NOT NULL,
    "startDato" TIMESTAMP(3) NOT NULL,
    "slutDato" TIMESTAMP(3),
    "arligKvote" INTEGER NOT NULL DEFAULT 0,
    "forbrugtKvote" INTEGER NOT NULL DEFAULT 0,
    "kontaktperson" TEXT,
    "pris" INTEGER NOT NULL DEFAULT 0,
    "instansId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "branche" TEXT,
    "kontakt" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "beskrivelse" TEXT NOT NULL,
    "leverancetype" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Åben',
    "iPulje" BOOLEAN NOT NULL DEFAULT false,
    "researchDeadline" TIMESTAMP(3),
    "afleveringsDeadline" TIMESTAMP(3) NOT NULL,
    "estimeretHonorar" INTEGER NOT NULL,
    "interessekonflikt" TEXT,
    "konfliktGennemgaaet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instansId" TEXT NOT NULL,
    "assignedAuthorId" TEXT,
    "articleId" TEXT,
    "supportAgreementId" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HonorRate" (
    "id" TEXT NOT NULL,
    "leverancetype" TEXT NOT NULL,
    "minimum" INTEGER NOT NULL,
    "maksimum" INTEGER NOT NULL,
    "standard" INTEGER NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HonorRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HonorEntry" (
    "id" TEXT NOT NULL,
    "beloeb" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Afventer',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "instansId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "HonorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "beskrivelse" TEXT,
    "coverUrl" TEXT,
    "kategorier" JSONB NOT NULL DEFAULT '[]',
    "notable" BOOLEAN NOT NULL DEFAULT false,
    "kildeAntal" INTEGER NOT NULL DEFAULT 0,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "overskrift" TEXT NOT NULL,
    "brødtekst" TEXT,
    "kilde" TEXT NOT NULL DEFAULT 'Intern',
    "kildeUrl" TEXT,
    "notable" BOOLEAN NOT NULL DEFAULT false,
    "breaking" BOOLEAN NOT NULL DEFAULT false,
    "laest" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalId" TEXT,
    "kildeUrlNorm" TEXT,
    "sourceType" TEXT,
    "omraadeId" TEXT,
    "omraadeTekst" TEXT,
    "kildeTidspunkt" TIMESTAMP(3),
    "maskinindsamlet" BOOLEAN NOT NULL DEFAULT false,
    "ingestKeyId" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "tekst" TEXT NOT NULL,
    "dato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpagePlacement" (
    "id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "udloebTid" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontpagePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "annoncoer" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Kladde',
    "startDato" TIMESTAMP(3) NOT NULL,
    "slutDato" TIMESTAMP(3) NOT NULL,
    "pris" INTEGER NOT NULL DEFAULT 0,
    "placeringZone" TEXT NOT NULL DEFAULT 'feed',
    "kreativData" JSONB NOT NULL,
    "visninger" INTEGER NOT NULL DEFAULT 0,
    "klik" INTEGER NOT NULL DEFAULT 0,
    "maksVisninger" INTEGER,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleMetric" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "visninger" INTEGER NOT NULL DEFAULT 0,
    "laesninger" INTEGER NOT NULL DEFAULT 0,
    "totalLaesetidSek" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hourlyViews" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opdateretTid" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "kontakt" TEXT NOT NULL,
    "emne" TEXT NOT NULL,
    "tekst" TEXT NOT NULL,
    "omraadeId" TEXT,
    "billederUrl" JSONB,
    "rettighederAccepteret" BOOLEAN NOT NULL DEFAULT true,
    "samtykkeAccepteret" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Ny',
    "noter" TEXT,
    "articleId" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "navn" TEXT,
    "sektionSlug" TEXT,
    "omraadeSlug" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "bekraeftetTid" TIMESTAMP(3),
    "afmeldtTid" TIMESTAMP(3),
    "afmeldingsToken" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceQA" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "emne" TEXT NOT NULL,
    "baggrund" TEXT,
    "deadline" TIMESTAMP(3),
    "kildeNavn" TEXT NOT NULL,
    "kildeKontakt" TEXT NOT NULL,
    "kildeRolle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Sendt',
    "spoergsmaal" JSONB NOT NULL,
    "svar" JSONB,
    "citater" JSONB,
    "aiOpsummering" TEXT,
    "noter" TEXT,
    "instansId" TEXT NOT NULL,
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceQA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "titel" TEXT NOT NULL DEFAULT 'Interview',
    "arbejdstitel" TEXT,
    "emne" TEXT NOT NULL,
    "formaal" TEXT,
    "baggrund" TEXT,
    "journalistNavn" TEXT,
    "kildeNavn" TEXT NOT NULL,
    "kildeTitel" TEXT,
    "kildeRolle" TEXT,
    "kildeKontakt" TEXT NOT NULL,
    "forventetPublicering" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Oprettet',
    "spoergsmaal" JSONB NOT NULL,
    "svar" JSONB,
    "citater" JSONB,
    "transskription" TEXT,
    "aiOpsummering" TEXT,
    "noter" TEXT,
    "instansId" TEXT NOT NULL,
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorBrief" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "partnerNavn" TEXT NOT NULL,
    "kontaktNavn" TEXT NOT NULL,
    "kontaktEmail" TEXT NOT NULL,
    "kontaktTelefon" TEXT,
    "format" TEXT NOT NULL DEFAULT 'native_artikel',
    "status" TEXT NOT NULL DEFAULT 'Booket',
    "pakkeNavn" TEXT,
    "kampagnePeriode" TEXT,
    "hovedbudskab" TEXT,
    "baggrundstekst" TEXT,
    "briefData" JSONB,
    "citater" JSONB,
    "noegletal" JSONB,
    "materialerUrl" JSONB,
    "logoUrl" TEXT,
    "billederUrl" JSONB,
    "reviewItems" JSONB,
    "noter" TEXT,
    "instansId" TEXT NOT NULL,
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeddelerProfile" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "kontakt" TEXT NOT NULL,
    "telefon" TEXT,
    "phone" TEXT,
    "organisation" TEXT,
    "kategori" TEXT NOT NULL DEFAULT 'tip',
    "omraader" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "noter" TEXT,
    "instansId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeddelerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeddelerSag" (
    "id" TEXT NOT NULL,
    "meddelerId" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "kategori" TEXT NOT NULL DEFAULT 'tip',
    "status" TEXT NOT NULL DEFAULT 'Ny',
    "tekst" TEXT NOT NULL,
    "billederUrl" JSONB,
    "audioUrl" TEXT,
    "aiStruktureret" JSONB,
    "struktureret" JSONB,
    "opfoelgendeSpm" JSONB,
    "opfoelgning" JSONB,
    "interneNoter" TEXT,
    "instansId" TEXT NOT NULL,
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeddelerSag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpageLayout" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'kladde',
    "version" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "modules" JSONB NOT NULL,
    "scope" JSONB,
    "createdBy" TEXT,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontpageLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpageLayoutVersion" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "modules" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrontpageLayoutVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpageSnapshot" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "layoutId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'forslag',
    "items" JSONB NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'forslag',
    "generatedBy" TEXT NOT NULL DEFAULT 'deterministic',
    "modelId" TEXT,
    "inputHash" TEXT,
    "godkendtAf" TEXT,
    "godkendtTid" TIMESTAMP(3),
    "afvistAf" TEXT,
    "afvistTid" TIMESTAMP(3),
    "afvistGrund" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontpageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpageDecision" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT,
    "instansId" TEXT NOT NULL,
    "articleId" TEXT,
    "slot" TEXT NOT NULL,
    "handling" TEXT NOT NULL,
    "kilde" TEXT NOT NULL,
    "begrundelse" TEXT,
    "konfidens" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrontpageDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontpageSlotMetric" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "day" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontpageSlotMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArticleToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ArticleToGeoTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToGeoTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_navn_key" ON "Role"("navn");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authorId_key" ON "User"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_instansId_slug_key" ON "Author"("instansId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_instansId_slug_key" ON "Category"("instansId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_instansId_navn_key" ON "Tag"("instansId", "navn");

-- CreateIndex
CREATE UNIQUE INDEX "GeoTag_instansId_slug_key" ON "GeoTag"("instansId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "GeoTag_instansId_navn_key" ON "GeoTag"("instansId", "navn");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_instansId_status_idx" ON "Article"("instansId", "status");

-- CreateIndex
CREATE INDEX "Article_instansId_indholdstype_idx" ON "Article"("instansId", "indholdstype");

-- CreateIndex
CREATE UNIQUE INDEX "Article_instansId_externalId_key" ON "Article"("instansId", "externalId");

-- CreateIndex
CREATE INDEX "ArticleRevision_articleId_idx" ON "ArticleRevision"("articleId");

-- CreateIndex
CREATE INDEX "Media_instansId_filtype_idx" ON "Media"("instansId", "filtype");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_articleId_key" ON "Assignment"("articleId");

-- CreateIndex
CREATE INDEX "Assignment_instansId_status_idx" ON "Assignment"("instansId", "status");

-- CreateIndex
CREATE INDEX "Assignment_assignedAuthorId_afleveringsDeadline_idx" ON "Assignment"("assignedAuthorId", "afleveringsDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "HonorRate_instansId_leverancetype_key" ON "HonorRate"("instansId", "leverancetype");

-- CreateIndex
CREATE UNIQUE INDEX "HonorEntry_assignmentId_key" ON "HonorEntry"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HonorEntry_articleId_key" ON "HonorEntry"("articleId");

-- CreateIndex
CREATE INDEX "HonorEntry_instansId_status_idx" ON "HonorEntry"("instansId", "status");

-- CreateIndex
CREATE INDEX "HonorEntry_authorId_generatedAt_idx" ON "HonorEntry"("authorId", "generatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_instansId_createdAt_idx" ON "ChatMessage"("instansId", "createdAt");

-- CreateIndex
CREATE INDEX "Topic_instansId_idx" ON "Topic"("instansId");

-- CreateIndex
CREATE INDEX "Signal_instansId_laest_idx" ON "Signal"("instansId", "laest");

-- CreateIndex
CREATE INDEX "Signal_instansId_createdAt_idx" ON "Signal"("instansId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_instansId_externalId_key" ON "Signal"("instansId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_instansId_kildeUrlNorm_key" ON "Signal"("instansId", "kildeUrlNorm");

-- CreateIndex
CREATE INDEX "Correction_instansId_idx" ON "Correction"("instansId");

-- CreateIndex
CREATE INDEX "Correction_articleId_idx" ON "Correction"("articleId");

-- CreateIndex
CREATE INDEX "FrontpagePlacement_instansId_zone_idx" ON "FrontpagePlacement"("instansId", "zone");

-- CreateIndex
CREATE INDEX "FrontpagePlacement_articleId_idx" ON "FrontpagePlacement"("articleId");

-- CreateIndex
CREATE INDEX "AdCampaign_instansId_status_idx" ON "AdCampaign"("instansId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_instansId_placeringZone_idx" ON "AdCampaign"("instansId", "placeringZone");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleMetric_articleId_key" ON "ArticleMetric"("articleId");

-- CreateIndex
CREATE INDEX "ArticleMetric_instansId_score_idx" ON "ArticleMetric"("instansId", "score");

-- CreateIndex
CREATE INDEX "Submission_instansId_status_idx" ON "Submission"("instansId", "status");

-- CreateIndex
CREATE INDEX "Submission_instansId_createdAt_idx" ON "Submission"("instansId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_instansId_aktiv_idx" ON "NewsletterSubscriber"("instansId", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_instansId_email_key" ON "NewsletterSubscriber"("instansId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SourceQA_token_key" ON "SourceQA"("token");

-- CreateIndex
CREATE INDEX "SourceQA_instansId_status_idx" ON "SourceQA"("instansId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_token_key" ON "InterviewSession"("token");

-- CreateIndex
CREATE INDEX "InterviewSession_instansId_status_idx" ON "InterviewSession"("instansId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorBrief_token_key" ON "SponsorBrief"("token");

-- CreateIndex
CREATE INDEX "SponsorBrief_instansId_status_idx" ON "SponsorBrief"("instansId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeddelerProfile_token_key" ON "MeddelerProfile"("token");

-- CreateIndex
CREATE INDEX "MeddelerProfile_instansId_aktiv_idx" ON "MeddelerProfile"("instansId", "aktiv");

-- CreateIndex
CREATE INDEX "MeddelerSag_instansId_status_idx" ON "MeddelerSag"("instansId", "status");

-- CreateIndex
CREATE INDEX "MeddelerSag_meddelerId_idx" ON "MeddelerSag"("meddelerId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");

-- CreateIndex
CREATE INDEX "ApiKey_instansId_idx" ON "ApiKey"("instansId");

-- CreateIndex
CREATE INDEX "FrontpageLayout_instansId_status_idx" ON "FrontpageLayout"("instansId", "status");

-- CreateIndex
CREATE INDEX "FrontpageLayoutVersion_instansId_createdAt_idx" ON "FrontpageLayoutVersion"("instansId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FrontpageLayoutVersion_layoutId_version_key" ON "FrontpageLayoutVersion"("layoutId", "version");

-- CreateIndex
CREATE INDEX "FrontpageSnapshot_instansId_status_createdAt_idx" ON "FrontpageSnapshot"("instansId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FrontpageSnapshot_instansId_inputHash_idx" ON "FrontpageSnapshot"("instansId", "inputHash");

-- CreateIndex
CREATE INDEX "FrontpageDecision_snapshotId_idx" ON "FrontpageDecision"("snapshotId");

-- CreateIndex
CREATE INDEX "FrontpageDecision_instansId_createdAt_idx" ON "FrontpageDecision"("instansId", "createdAt");

-- CreateIndex
CREATE INDEX "FrontpageSlotMetric_instansId_day_idx" ON "FrontpageSlotMetric"("instansId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "FrontpageSlotMetric_instansId_moduleId_slotKey_articleId_da_key" ON "FrontpageSlotMetric"("instansId", "moduleId", "slotKey", "articleId", "day");

-- CreateIndex
CREATE INDEX "_ArticleToTag_B_index" ON "_ArticleToTag"("B");

-- CreateIndex
CREATE INDEX "_ArticleToGeoTag_B_index" ON "_ArticleToGeoTag"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoTag" ADD CONSTRAINT "GeoTag_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_forfatterId_fkey" FOREIGN KEY ("forfatterId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_supportAftaleId_fkey" FOREIGN KEY ("supportAftaleId") REFERENCES "SupportAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAgreement" ADD CONSTRAINT "SupportAgreement_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAgreement" ADD CONSTRAINT "SupportAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedAuthorId_fkey" FOREIGN KEY ("assignedAuthorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_supportAgreementId_fkey" FOREIGN KEY ("supportAgreementId") REFERENCES "SupportAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorRate" ADD CONSTRAINT "HonorRate_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorEntry" ADD CONSTRAINT "HonorEntry_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorEntry" ADD CONSTRAINT "HonorEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorEntry" ADD CONSTRAINT "HonorEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorEntry" ADD CONSTRAINT "HonorEntry_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorEntry" ADD CONSTRAINT "HonorEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_omraadeId_fkey" FOREIGN KEY ("omraadeId") REFERENCES "GeoTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpagePlacement" ADD CONSTRAINT "FrontpagePlacement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpagePlacement" ADD CONSTRAINT "FrontpagePlacement_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMetric" ADD CONSTRAINT "ArticleMetric_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMetric" ADD CONSTRAINT "ArticleMetric_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_omraadeId_fkey" FOREIGN KEY ("omraadeId") REFERENCES "GeoTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceQA" ADD CONSTRAINT "SourceQA_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceQA" ADD CONSTRAINT "SourceQA_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorBrief" ADD CONSTRAINT "SponsorBrief_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorBrief" ADD CONSTRAINT "SponsorBrief_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeddelerProfile" ADD CONSTRAINT "MeddelerProfile_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeddelerSag" ADD CONSTRAINT "MeddelerSag_meddelerId_fkey" FOREIGN KEY ("meddelerId") REFERENCES "MeddelerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeddelerSag" ADD CONSTRAINT "MeddelerSag_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeddelerSag" ADD CONSTRAINT "MeddelerSag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageLayout" ADD CONSTRAINT "FrontpageLayout_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageLayoutVersion" ADD CONSTRAINT "FrontpageLayoutVersion_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FrontpageLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageLayoutVersion" ADD CONSTRAINT "FrontpageLayoutVersion_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageSnapshot" ADD CONSTRAINT "FrontpageSnapshot_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageSnapshot" ADD CONSTRAINT "FrontpageSnapshot_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FrontpageLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageDecision" ADD CONSTRAINT "FrontpageDecision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "FrontpageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageDecision" ADD CONSTRAINT "FrontpageDecision_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontpageSlotMetric" ADD CONSTRAINT "FrontpageSlotMetric_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToTag" ADD CONSTRAINT "_ArticleToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToTag" ADD CONSTRAINT "_ArticleToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToGeoTag" ADD CONSTRAINT "_ArticleToGeoTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToGeoTag" ADD CONSTRAINT "_ArticleToGeoTag_B_fkey" FOREIGN KEY ("B") REFERENCES "GeoTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

