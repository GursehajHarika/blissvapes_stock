/*
  Warnings:

  - A unique constraint covering the columns `[inventoryItemGid]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "inventoryItemGid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_inventoryItemGid_key" ON "ProductVariant"("inventoryItemGid");
