-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "buyerScore" INTEGER NOT NULL DEFAULT 0,
    "sellerScore" INTEGER NOT NULL DEFAULT 0,
    "kycStatus" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isRider" BOOLEAN NOT NULL DEFAULT false,
    "isHubStaff" BOOLEAN NOT NULL DEFAULT false,
    "hubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
