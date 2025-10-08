-- CreateTable
CREATE TABLE "VariantInventoryLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "locationGid" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "available" INTEGER NOT NULL,
    CONSTRAINT "VariantInventoryLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VariantInventoryLevel_locationGid_idx" ON "VariantInventoryLevel"("locationGid");

-- CreateIndex
CREATE UNIQUE INDEX "VariantInventoryLevel_variantId_locationGid_key" ON "VariantInventoryLevel"("variantId", "locationGid");
