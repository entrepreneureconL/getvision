/**
 * Schemas zod para Business — actualizado en F0-2.5 con campos del rediseño adaptable.
 *
 * Cambios vs F0-4:
 *   + DetailLevelEnum  ('simple' | 'detailed')  — gobierna densidad del dashboard
 *   + OperatorRoleEnum ('solo' | 'team' | 'administrator')  — tag secundario, sin UX visible en F0
 *   + subrubro                                  — drill-down opcional sobre rubro
 *   + threshold_hourly_rate                     — costo de oportunidad opcional para comparar
 */

import { z } from 'zod';

// Enums originales (sin cambios)
export const IncomeModelEnum = z.enum(['services', 'products', 'mixed']);
export type IncomeModel = z.infer<typeof IncomeModelEnum>;

export const SectorEnum = z.enum(['commerce', 'services', 'industry', 'agro']);
export type Sector = z.infer<typeof SectorEnum>;

// Enums nuevos (F0-2.5)
export const DetailLevelEnum = z.enum(['simple', 'detailed']);
export type DetailLevel = z.infer<typeof DetailLevelEnum>;

export const OperatorRoleEnum = z.enum(['solo', 'team', 'administrator']);
export type OperatorRole = z.infer<typeof OperatorRoleEnum>;

// F1-M.2: eje de desglose de los bloques flow (Ingresos/Costos del mes).
//   'channel'  → suma por cuenta (Efectivo / MP / Banco / …)
//   'category' → suma por etiqueta (Corte / Color / Tratamiento / …)
// Una columna por bloque porque el uso real diverge.
export const BreakdownAxisEnum = z.enum(['channel', 'category']);
export type BreakdownAxis = z.infer<typeof BreakdownAxisEnum>;

/**
 * BusinessSchema — forma esperada del row de businesses.
 *
 * Los campos F0-2.5 (detail_level, operator_role) tienen default en la DB.
 * Los marcamos optional+nullable en TS porque:
 *   - Usuarios existentes pueden tener un select que no los pidió.
 *   - Defensa en profundidad: si la DB devuelve null por algún motivo, no rompemos.
 */
export const BusinessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(150),
  sector: SectorEnum.nullable().optional(),
  rubro: z.string().max(80).nullable().optional(),
  subrubro: z.string().max(100).nullable().optional(),                 // NUEVO F0-2.5
  income_model: IncomeModelEnum.nullable().optional(),
  onboarding_completed: z.boolean().nullable().optional(),
  detail_level: DetailLevelEnum.nullable().optional(),                 // NUEVO F0-2.5
  operator_role: OperatorRoleEnum.nullable().optional(),               // NUEVO F0-2.5
  threshold_hourly_rate: z.coerce.number().nonnegative().nullable().optional(), // NUEVO F0-2.5
  income_breakdown_axis:  BreakdownAxisEnum.nullable().optional(),               // NUEVO F1-M.2
  expense_breakdown_axis: BreakdownAxisEnum.nullable().optional(),               // NUEVO F1-M.2
});

export type Business = z.infer<typeof BusinessSchema>;

/**
 * Helper para leer el detail_level con default seguro.
 * Si el campo viene null/undefined, asumimos 'simple' (UX más amigable para nuevos).
 */
export function getDetailLevel(b: Business): DetailLevel {
  return b.detail_level ?? 'simple';
}

/**
 * Helper para leer operator_role con default.
 * Default 'solo' coincide con target principal (unipersonal).
 */
export function getOperatorRole(b: Business): OperatorRole {
  return b.operator_role ?? 'solo';
}

/**
 * F1-M.2 — helpers para los ejes de desglose del flow.
 * Default 'channel' = lo que ya conoce el usuario hoy (composición por cuenta).
 * Caer en default cubre el período entre deploy del código y aplicación de la
 * migration `F1-M.2_breakdown_axis_migration.sql` en Supabase.
 */
export function getIncomeBreakdownAxis(b: Business): BreakdownAxis {
  return b.income_breakdown_axis ?? 'channel';
}
export function getExpenseBreakdownAxis(b: Business): BreakdownAxis {
  return b.expense_breakdown_axis ?? 'channel';
}

export function parseBusiness(raw: unknown): Business | null {
  const result = BusinessSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[schema] Business inválido:', result.error.issues);
    return null;
  }
  return result.data;
}
