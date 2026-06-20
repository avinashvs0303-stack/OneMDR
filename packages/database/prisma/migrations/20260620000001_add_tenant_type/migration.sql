-- CreateEnum
CREATE TYPE "tenant_type" AS ENUM ('STANDARD', 'MSSP');

-- AlterTable tenants
ALTER TABLE "tenants"
  ADD COLUMN "tenant_type"      "tenant_type" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "parent_tenant_id" UUID REFERENCES "tenants"("id") ON DELETE SET NULL,
  ADD COLUMN "max_sub_tenants"  INTEGER;

-- AlterTable tenant_requests
ALTER TABLE "tenant_requests"
  ADD COLUMN "tenant_type"     "tenant_type" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "max_sub_tenants" INTEGER;

-- CreateIndex (for hierarchy lookups)
CREATE INDEX "tenants_parent_tenant_id_idx" ON "tenants"("parent_tenant_id");
