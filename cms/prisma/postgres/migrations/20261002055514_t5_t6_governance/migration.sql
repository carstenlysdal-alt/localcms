-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "godkendtAf" TEXT,
ADD COLUMN     "godkendtTid" TIMESTAMP(3),
ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "Correction" ADD COLUMN     "fjernetAf" TEXT,
ADD COLUMN     "fjernetTid" TIMESTAMP(3),
ADD COLUMN     "oprettetAf" TEXT;

-- CreateIndex
CREATE INDEX "Signal_instansId_godkendtTid_idx" ON "Signal"("instansId", "godkendtTid");

