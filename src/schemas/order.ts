/**
 * Schemas zod para Order (pedidos de clientes) — F1-O Etapa 2 / D-21 / P-011.
 *
 * Un pedido NO es una transaction: la plata todavía no se movió (ADR #20).
 * Vive en la tabla `orders` y se convierte en transaction income al entregar
 * (RPC atómica `deliver_order` — ver ordersRepo.deliver).
 *
 * Ciclo de vida (estados terminales, sin "reabrir" en v1):
 *   pending ──deliver──▶ delivered  (con transaction_id vinculada)
 *   pending ──cancel───▶ cancelled  (sin transaction)
 *
 * `delivery_date` es 'YYYY-MM-DD' LOCAL — siempre generada con
 * toLocalISODate/todayLocalISO de periods.ts (LESSONS #2).
 */

import { z } from 'zod';

export const OrderStatusEnum = z.enum(['pending', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

/**
 * OrderSchema — forma esperada del row de la tabla `orders`.
 *
 * amount es z.coerce.number() por el clásico DECIMAL-como-string de
 * Supabase (mismo patrón que TransactionSchema).
 */
export const OrderSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  client_name: z.string().min(1).max(100),
  client_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  delivery_date: z.string(), // 'YYYY-MM-DD' — fecha comprometida de entrega
  delivery_time: z.string().nullable().optional(), // 'HH:MM:SS' — UI v1 no la pide
  status: OrderStatusEnum,
  transaction_id: z.string().uuid().nullable().optional(),
  external_event_id: z.string().nullable().optional(), // reservado P-012
  notes: z.string().max(200).nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

/**
 * Input de creación — alcance v1 mínimo decidido por el CEO (ADR #30):
 * cliente, descripción, monto, fecha de entrega. El resto es opcional.
 * business_id lo agrega el repo (el form no lo conoce).
 */
export const OrderInsertSchema = z.object({
  business_id: z.string().uuid(),
  client_name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(120),
  amount: z.coerce.number().positive(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_time: z.string().nullable().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});

export type OrderInsert = z.infer<typeof OrderInsertSchema>;

/**
 * Patch de edición — solo campos editables, y solo sobre pedidos 'pending'
 * (el repo agrega el guard de estado en el WHERE). El status NUNCA se toca
 * por update directo: 'delivered' solo via RPC deliver_order, 'cancelled'
 * solo via ordersRepo.cancel.
 */
export const OrderPatchSchema = OrderInsertSchema.omit({ business_id: true }).partial();
export type OrderPatch = z.infer<typeof OrderPatchSchema>;

/** Helper semántico: ¿el pedido sigue vivo (editable, entregable, en agenda)? */
export function isOpenOrder(o: Order): boolean {
  return o.status === 'pending';
}

/**
 * Para listas: valida cada item y descarta los inválidos sin romper la lista
 * (mismo patrón resiliente que parseTransactionList).
 */
export function parseOrderList(raw: unknown): Order[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] parseOrderList: input no es array');
    return [];
  }
  const valid: Order[] = [];
  for (const item of raw) {
    const result = OrderSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn('[schema] Order inválida (descartada):', result.error.issues);
    }
  }
  return valid;
}

export function parseOrder(raw: unknown): Order | null {
  const result = OrderSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[schema] Order inválida:', result.error.issues);
    return null;
  }
  return result.data;
}
