/**
 * Schemas zod para Transaction
 *
 * La tabla transactions tiene más combinaciones de tipos que businesses
 * (ingreso normal, ingreso extraordinario, expense, pendiente, etc).
 * Los enums acá son la fuente de verdad para todo el código.
 *
 * F1-J — Refundación stock-flow:
 *   Se agregan 3 campos nullable que conviven con el modelo viejo:
 *     - settled_at        DATE       NULL = pendiente cobro/pago
 *     - from_account_id   UUID       cuenta de salida (egresos saldados)
 *     - to_account_id     UUID       cuenta de entrada (ingresos saldados)
 *
 *   El campo legacy `status` ('completed'|'pending') queda en el schema por
 *   compatibilidad con filas viejas, pero el código nuevo decide por
 *   `settled_at IS NULL`. En F2 se podrá deprecar status.
 */

import { z } from 'zod';

export const TransactionTypeEnum = z.enum([
  'income',
  'expense',
  'income_extraordinary',
  'expense_extraordinary',
]);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

export const TransactionStatusEnum = z.enum(['completed', 'pending']);
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

export const PaymentMethodEnum = z.enum([
  'cash',
  'transfer',
  'credit',
  'pending',
  'digital',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

/**
 * TransactionSchema — forma esperada del row de la tabla transactions.
 *
 * amount es z.coerce.number() porque Supabase a veces devuelve DECIMAL
 * como string (e.g. "1234.56"). coerce hace el cast a number antes de validar.
 * Reemplaza el Number(t.amount) regado por el código.
 *
 * .positive() captura el error clásico de guardar montos negativos directos
 * (la regla del proyecto es: amount siempre positivo, el signo lo define `type`).
 */
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  type: TransactionTypeEnum,
  amount: z.coerce.number().positive(),
  date: z.string(),  // 'YYYY-MM-DD' — fecha del hecho económico (devengado)
  payment_method: PaymentMethodEnum.nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  description: z.string().max(120).nullable().optional(),
  status: TransactionStatusEnum.nullable().optional(),  // legacy F0/F1-D — derivable desde settled_at
  created_at: z.string().nullable().optional(),

  // F1-J — stock/flow encoding
  settled_at: z.string().nullable().optional(),        // 'YYYY-MM-DD' — fecha en que se movió la plata
  from_account_id: z.string().uuid().nullable().optional(),
  to_account_id: z.string().uuid().nullable().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Helper semántico: una transaction está pendiente si todavía no se cobró/pagó.
 * Centralizamos la regla acá para no replicar `t.settled_at == null` en repos/utils.
 */
export function isPending(t: Transaction): boolean {
  return t.settled_at == null;
}

/**
 * Para cuando recibimos una lista. Validamos cada item; los inválidos
 * se filtran (no rompen toda la lista).
 *
 * En C++ sería algo como std::vector<Transaction> donde solo se pushean
 * los que pasaron el constructor de validación.
 */
export function parseTransactionList(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] parseTransactionList: input no es array');
    return [];
  }
  const valid: Transaction[] = [];
  for (const item of raw) {
    const result = TransactionSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn('[schema] Transaction inválida (descartada):', result.error.issues);
    }
  }
  return valid;
}

export function parseTransaction(raw: unknown): Transaction | null {
  const result = TransactionSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[schema] Transaction inválida:', result.error.issues);
    return null;
  }
  return result.data;
}
