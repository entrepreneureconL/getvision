/**
 * Schemas zod para Product (catálogo de lo que vende el negocio).
 *
 * Sólo se usa cuando income_model ∈ {'products', 'mixed'}.
 * Los KPIs de stock del dashboard se calculan agregando esta tabla.
 */

import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  sku: z.string().max(50).nullable().optional(),
  stock_actual: z.coerce.number().nonnegative(),  // DECIMAL viene como string a veces
  unit_cost: z.coerce.number().nonnegative().nullable().optional(),
  unit_price: z.coerce.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.coerce.number().nonnegative().nullable().optional(),
  active: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

/**
 * Schema para crear product nuevo (sin id ni timestamps — los pone la DB).
 * Pick + omit + extend juntos serían más limpios pero esto es explícito.
 */
export const ProductInsertSchema = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  sku: z.string().max(50).nullable().optional(),
  stock_actual: z.coerce.number().nonnegative().default(0),
  unit_cost: z.coerce.number().nonnegative().nullable().optional(),
  unit_price: z.coerce.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.coerce.number().nonnegative().nullable().optional(),
});

export type ProductInsert = z.infer<typeof ProductInsertSchema>;

export function parseProduct(raw: unknown): Product | null {
  const r = ProductSchema.safeParse(raw);
  if (!r.success) {
    console.warn('[schema] Product inválido:', r.error.issues);
    return null;
  }
  return r.data;
}

export function parseProductList(raw: unknown): Product[] {
  if (!Array.isArray(raw)) return [];
  const valid: Product[] = [];
  for (const item of raw) {
    const r = ProductSchema.safeParse(item);
    if (r.success) valid.push(r.data);
    else console.warn('[schema] Product descartado:', r.error.issues);
  }
  return valid;
}
