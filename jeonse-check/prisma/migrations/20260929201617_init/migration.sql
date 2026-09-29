-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseType" AS ENUM ('APARTMENT', 'ROW_HOUSE');

-- CreateEnum
CREATE TYPE "DealKind" AS ENUM ('SALE', 'LEASE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "houseType" "HouseType" NOT NULL,
    "dealKind" "DealKind" NOT NULL,
    "lawdCd" CHAR(5) NOT NULL,
    "dealYmd" CHAR(6) NOT NULL,
    "umdName" TEXT NOT NULL,
    "jibun" TEXT,
    "buildingName" TEXT,
    "exclusiveArea" DECIMAL(10,4) NOT NULL,
    "floor" INTEGER,
    "contractDate" DATE NOT NULL,
    "priceManwon" INTEGER,
    "depositManwon" INTEGER,
    "monthlyRentManwon" INTEGER,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledDate" DATE,
    "buildingKey" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionLog" (
    "id" TEXT NOT NULL,
    "lawdCd" CHAR(5) NOT NULL,
    "dealYmd" CHAR(6) NOT NULL,
    "houseType" "HouseType" NOT NULL,
    "dealKind" "DealKind" NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemCount" INTEGER NOT NULL,

    CONSTRAINT "CollectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "dataBaseDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_dedupKey_key" ON "Trade"("dedupKey");

-- CreateIndex
CREATE INDEX "Trade_lawdCd_dealYmd_houseType_dealKind_idx" ON "Trade"("lawdCd", "dealYmd", "houseType", "dealKind");

-- CreateIndex
CREATE INDEX "Trade_buildingKey_idx" ON "Trade"("buildingKey");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionLog_lawdCd_dealYmd_houseType_dealKind_key" ON "CollectionLog"("lawdCd", "dealYmd", "houseType", "dealKind");

-- CreateIndex
CREATE INDEX "SavedResult_userId_createdAt_idx" ON "SavedResult"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResult" ADD CONSTRAINT "SavedResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
