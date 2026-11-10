import { z } from "zod";

const uuid = z.string().uuid();
const optionalUuid = z
  .union([uuid, z.literal("")])
  .transform((value) => value || null);
export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000),
  categoryId: uuid,
  productTypeId: optionalUuid,
  brandId: optionalUuid,
  unitId: uuid,
  status: z.enum(["DRAFT", "ACTIVE"]),
  isPublic: z.boolean(),
  variantName: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80),
  retailPrice: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).optional(),
  ),
  wholesalePrice: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).optional(),
  ),
  size: z.string().trim().max(160),
  colour: z.string().trim().max(160),
});
export const referenceSchema = z.object({
  kind: z.enum(["category", "brand", "unit", "attribute"]),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(40),
  slug: z.string().trim().max(120),
  parentId: optionalUuid,
  symbol: z.string().trim().max(16),
  dataType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "SELECT"]),
});
export const idSchema = uuid;
