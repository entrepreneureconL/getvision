/**
 * Schemas zod para Account (F1-J).
 *
 * Una `account` es donde el negocio guarda plata: efectivo, banco, Mercado Pago,
 * billeteras virtuales. Cada business tiene N accounts. El balance se calcula
 * en `accountsRepo.getBalances()` sumando initial_balance + movimientos.
 *
 * Las accounts NO son el "plan de cuentas" contable. Son cuentas físicas que el
 * usuario percibe ("mi caja", "mi MP"). El motor las usa para distinguir caja
 * real (cash/bank/mp/wallet) de cuentas conceptuales (NA todavía).
 */

import { z } from 'zod';

export const AccountKindEnum = z.enum(['cash', 'bank', 'mp', 'wallet', 'other']);
export type AccountKind = z.infer<typeof AccountKindEnum>;

/**
 * Forma esperada del row de la tabla `accounts`.
 *
 * initial_balance es z.coerce.number() por la misma razón que amount en
 * Transaction: Supabase a veces devuelve DECIMAL como string.
 */
export const AccountSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().min(1).max(60),
  kind: AccountKindEnum,
  is_default: z.boolean(),
  initial_balance: z.coerce.number(),
  archived_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * Como `parseTransactionList`: validamos cada row. Inválidos se descartan
 * (no rompen el render de la lista entera).
 */
export function parseAccountList(raw: unknown): Account[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] parseAccountList: input no es array');
    return [];
  }
  const valid: Account[] = [];
  for (const item of raw) {
    const result = AccountSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn('[schema] Account inválida (descartada):', result.error.issues);
    }
  }
  return valid;
}

export function parseAccount(raw: unknown): Account | null {
  const result = AccountSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[schema] Account inválida:', result.error.issues);
    return null;
  }
  return result.data;
}
