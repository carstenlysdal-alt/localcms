-- CreateTable
CREATE TABLE "UserInstanceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstanceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserInstanceAccess_instansId_idx" ON "UserInstanceAccess"("instansId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInstanceAccess_userId_instansId_key" ON "UserInstanceAccess"("userId", "instansId");

-- AddForeignKey
ALTER TABLE "UserInstanceAccess" ADD CONSTRAINT "UserInstanceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstanceAccess" ADD CONSTRAINT "UserInstanceAccess_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

