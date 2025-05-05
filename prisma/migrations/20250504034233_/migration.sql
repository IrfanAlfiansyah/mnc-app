/*
  Warnings:

  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "product" ADD COLUMN     "stok" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user" DROP CONSTRAINT "user_pkey",
DROP COLUMN "id",
ADD COLUMN     "user_id" SERIAL NOT NULL,
ADD CONSTRAINT "user_pkey" PRIMARY KEY ("user_id");

-- CreateTable
CREATE TABLE "cart" (
    "cart_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("cart_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_user_id_product_id_key" ON "cart"("user_id", "product_id");
