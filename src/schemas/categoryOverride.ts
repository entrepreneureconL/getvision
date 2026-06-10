/**
 * Schemas zod para CategoryOverride (F1-L).
 *
 * Una fila representa una de estas dos cosas:
 *   (a) Custom — `value` distinto a cualquier default, `is_archived=false`.
 *       Suma al picker del business.
 *   (b) Archive — `value` matchea un default, `is_archived=true`.
 *       Oculta ese default del picker (no del código).
 *
 * En ambos casos, el value se guarda en `transactions.category` igual que los
 * defaults — la columna sigue siendo string libre (ADR #15 / #23).
 */

import { z } from 'zod';

export const CategoryOverrideTintEnum = z.enum([
  'success',
  'warning',
  'danger',
  'info',
  'accent',
]);
export type CategoryOverrideTint = z.infer<typeof CategoryOverrideTintEnum>;

export const CategoryOverrideTypeEnum = z.enum(['income', 'expense']);
export type CategoryOverrideType = z.infer<typeof CategoryOverrideTypeEnum>;

export const CategoryOverrideSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  value: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  icon: z.string().min(1).max(10),
  tint: CategoryOverrideTintEnum,
  type: CategoryOverrideTypeEnum,
  is_archived: z.boolean(),
  suggested_from_rubro: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type CategoryOverride = z.infer<typeof CategoryOverrideSchema>;

export function parseCategoryOverrideList(raw: unknown): CategoryOverride[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] parseCategoryOverrideList: input no es array');
    return [];
  }
  const valid: CategoryOverride[] = [];
  for (const item of raw) {
    const result = CategoryOverrideSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn('[schema] CategoryOverride inválida (descartada):', result.error.issues);
    }
  }
  return valid;
}

export function parseCategoryOverride(raw: unknown): CategoryOverride | null {
  const result = CategoryOverrideSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[schema] CategoryOverride inválida:', result.error.issues);
    return null;
  }
  return result.data;
}
