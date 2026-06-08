/**
 * Schemas zod para HoursLog (registro de horas trabajadas).
 *
 * Sólo se usa cuando income_model ∈ {'services', 'mixed'}.
 * Los KPIs de horas del dashboard se calculan agregando esta tabla.
 *
 * billable=false cubre capacitación, admin, comerciales sin cobro.
 * Útil para freelancers: "trabajé 160h pero solo 120h son facturables".
 */

import { z } from 'zod';

export const HoursLogSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  date: z.string(),                                  // 'YYYY-MM-DD'
  hours: z.coerce.number().positive(),
  hourly_rate: z.coerce.number().nonnegative().nullable().optional(),
  description: z.string().max(160).nullable().optional(),
  client_name: z.string().max(100).nullable().optional(),
  billable: z.boolean(),
  created_at: z.string().nullable().optional(),
});

export type HoursLog = z.infer<typeof HoursLogSchema>;

export const HoursLogInsertSchema = z.object({
  business_id: z.string().uuid(),
  date: z.string(),
  hours: z.coerce.number().positive(),
  hourly_rate: z.coerce.number().nonnegative().nullable().optional(),
  description: z.string().max(160).nullable().optional(),
  client_name: z.string().max(100).nullable().optional(),
  billable: z.boolean().default(true),
});

export type HoursLogInsert = z.infer<typeof HoursLogInsertSchema>;

export function parseHoursLog(raw: unknown): HoursLog | null {
  const r = HoursLogSchema.safeParse(raw);
  if (!r.success) {
    console.warn('[schema] HoursLog inválido:', r.error.issues);
    return null;
  }
  return r.data;
}

export function parseHoursLogList(raw: unknown): HoursLog[] {
  if (!Array.isArray(raw)) return [];
  const valid: HoursLog[] = [];
  for (const item of raw) {
    const r = HoursLogSchema.safeParse(item);
    if (r.success) valid.push(r.data);
    else console.warn('[schema] HoursLog descartado:', r.error.issues);
  }
  return valid;
}
