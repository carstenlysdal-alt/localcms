-- CreateTable
CREATE TABLE "OperatorAction" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tool" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "tokenHash" TEXT,
    "result" JSONB,
    "undo" JSONB,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAction_tokenHash_key" ON "OperatorAction"("tokenHash");

-- CreateIndex
CREATE INDEX "OperatorAction_instansId_userId_createdAt_idx" ON "OperatorAction"("instansId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAction_sessionId_idx" ON "OperatorAction"("sessionId");

