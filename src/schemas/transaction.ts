/**
 * Schemas zod para Transaction
 *
 * La tabla transactions tiene más combinaciones de tipos que businesses
 * (ingreso normal, ingreso extraordinario, expense, pendiente, etc).
 * Los enums acá son la fuente de verdad para todo el código.
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
  date: z.string(),  // 'YYYY-MM-DD' — no usamos z.date() porque viene como string ISO
  payment_method: PaymentMethodEnum.nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  description: z.string().max(120).nullable().optional(),
  status: TransactionStatusEnum.nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

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
