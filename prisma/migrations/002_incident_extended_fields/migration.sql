-- AlterTable
ALTER TABLE "Incident"
    ADD COLUMN     "sanv2Code" TEXT,
    ADD COLUMN     "country" TEXT,
    ADD COLUMN     "dayNumber" INTEGER,
    ADD COLUMN     "monthNumber" INTEGER,
    ADD COLUMN     "yearNumber" INTEGER,
    ADD COLUMN     "solutionType" TEXT,
    ADD COLUMN     "cause" TEXT,
    ADD COLUMN     "resolution" TEXT,
    ADD COLUMN     "produtosOkr" TEXT,
    ADD COLUMN     "coreSystems" TEXT,
    ADD COLUMN     "solver" TEXT,
    ADD COLUMN     "ordersAffected" TEXT,
    ADD COLUMN     "financialImpact" TEXT,
    ADD COLUMN     "totalMinutesReported" INTEGER,
    ADD COLUMN     "durationHoursReported" INTEGER,
    ADD COLUMN     "durationMinutesReported" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Incident_sanv2Code_key" ON "Incident"("sanv2Code");
