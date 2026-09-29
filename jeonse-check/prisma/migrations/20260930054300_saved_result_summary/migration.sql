-- 저장 기능(phase 6) 이전에는 SavedResult에 행이 없으므로 기본값 없이 NOT NULL로 추가한다.
-- AlterTable
ALTER TABLE "SavedResult" ADD COLUMN     "addressDisplay" TEXT NOT NULL,
ADD COLUMN     "signalCount" INTEGER NOT NULL;

