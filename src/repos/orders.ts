/**
 * ordersRepo — capa de acceso a la tabla `orders` (F1-O Etapa 2 / D-21 / P-011).
 *
 * Un pedido NO es una transaction (ADR #20): vive acá hasta que se entrega.
 * La conversión entregar→transaction es la RPC atómica `deliver_order`
 * (Fase 2A.2) — única puerta al estado 'delivered'. Este repo NUNCA setea
 * 'delivered' por update directo.
 *
 * Contratos de error (LESSONS #3 + #7):
 *   - Escrituras devuelven result discriminado { ok, code, message } — el
 *     caller distingue parse/rls/unknown y muestra la causa real.
 *   - update/cancel agregan guard `status='pending'` en el WHERE y verifican
 *     filas afectadas con .select('id') — editar un pedido ya entregado
 *     falla VISIBLE, no silencioso.
 *
 * Fechas: 'YYYY-MM-DD' local SIEMPRE via periods.ts (LESSONS #2).
 */

import { supabase } from '../lib/supabase';
import {
  OrderInsertSchema,
  OrderPatchSchema,
  parseOrder,
  parseOrderList,
  type Order,
  type OrderInsert,
  type OrderPatch,
} from '../schemas/order';
import { parseLocalISODate, toLocalISODate, todayLocalISO } from '../utils/periods';
import { eventsRepo } from './events';

export type OrderWriteResult =
  | { ok: true; order: Order }
  | { ok: false; code: 'parse' | 'rls' | 'unknown'; message: string };

export type OrderMutationResult =
  | { ok: true }
  | { ok: false; code: 'not_pending' | 'rls' | 'parse' | 'unknown'; message: string };

/** Mapea PG error codes a un code accionable (patrón categoriesRepo). */
function classifyError(error: { code?: string; message: string }): {
  code: 'rls' | 'unknown';
  message: string;
} {
  if (error.code === '42501') {
    return { code: 'rls', message: 'No tenés permiso para tocar este pedido.' };
  }
  return { code: 'unknown', message: 'No se pudo guardar el pedido. Probá de nuevo.' };
}

/** Días entre hoy (local) y la fecha de entrega — para telemetría, sin fechas absolutas. */
function daysAhead(deliveryDateISO: string): number {
  const today = parseLocalISODate(todayLocalISO()).getTime();
  const delivery = parseLocalISODate(deliveryDateISO).getTime();
  return Math.round((delivery - today) / 86_400_000);
}

export const ordersRepo = {
  /**
   * Pedidos del mes calendario del `anchorISO` ('YYYY-MM-DD'), todos los
   * estados. Alimenta la lista por día (split en el caller) y queda lista
   * para la vista detallada del calendario (P-014).
   */
  async listByMonth(businessId: string, anchorISO: string): Promise<Order[]> {
    const anchor = parseLocalISODate(anchorISO);
    const firstDay = toLocalISODate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const lastDay = toLocalISODate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', businessId)
      .gte('delivery_date', firstDay)
      .lte('delivery_date', lastDay)
      .order('delivery_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[repo:orders] listByMonth error:', error);
      return [];
    }
    return parseOrderList(data);
  },

  /**
   * Agenda de un día: pendientes primero (son lo accionable), después el
   * resto. El sort vive en JS — la lista de un día es chica y el criterio
   * "pending primero" es de presentación, no de datos.
   */
  async listByDay(businessId: string, dateISO: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', businessId)
      .eq('delivery_date', dateISO)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[repo:orders] listByDay error:', error);
      return [];
    }
    const all = parseOrderList(data);
    const rank = { pending: 0, delivered: 1, cancelled: 2 } as const;
    return all.sort((a, b) => rank[a.status] - rank[b.status]);
  },

  /**
   * Crea un pedido. Valida con zod ANTES del insert (regla #5).
   * El guardado no espera a nada externo (objetivo gráfico #4 de D-22):
   * la telemetría es fire-and-forget y el futuro sync de calendario jamás
   * se interpone acá.
   */
  async create(input: OrderInsert): Promise<OrderWriteResult> {
    const parsed = OrderInsertSchema.safeParse(input);
    if (!parsed.success) {
      console.warn('[repo:orders] create payload inválido:', parsed.error.issues);
      return { ok: false, code: 'parse', message: 'Revisá los datos del pedido.' };
    }

    const { data, error } = await supabase
      .from('orders')
      .insert(parsed.data)
      .select('*')
      .single();

    if (error) {
      console.error('[repo:orders] create error:', error);
      return { ok: false, ...classifyError(error) };
    }
    const order = parseOrder(data);
    if (!order) {
      return { ok: false, code: 'parse', message: 'El pedido se guardó pero no se pudo leer.' };
    }

    // Regla F1-N: sin montos ni PII. days_ahead es relativo (sin fechas absolutas).
    eventsRepo.track(order.business_id, 'order_created', {
      has_time: order.delivery_time != null,
      days_ahead: daysAhead(order.delivery_date),
    });
    return { ok: true, order };
  },

  /**
   * Edita un pedido 'pending'. El guard de estado va en el WHERE: si el
   * pedido ya se entregó/canceló (en otra pestaña, otro device), la edición
   * afecta 0 filas y devolvemos 'not_pending' — nunca éxito silencioso.
   */
  async update(id: string, patch: OrderPatch): Promise<OrderMutationResult> {
    const parsed = OrderPatchSchema.safeParse(patch);
    if (!parsed.success) {
      console.warn('[repo:orders] update patch inválido:', parsed.error.issues);
      return { ok: false, code: 'parse', message: 'Revisá los datos del pedido.' };
    }

    const { data, error } = await supabase
      .from('orders')
      .update(parsed.data)
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      console.error('[repo:orders] update error:', error);
      return { ok: false, ...classifyError(error) };
    }
    if (!data || data.length === 0) {
      console.error('[repo:orders] update silent fail — 0 filas. id=', id);
      return {
        ok: false,
        code: 'not_pending',
        message: 'Este pedido ya no se puede editar (¿se entregó o canceló?).',
      };
    }
    return { ok: true };
  },

  /**
   * Cancela un pedido 'pending' (estado terminal, sin transaction).
   * Mismo guard + verificación de filas que update.
   */
  async cancel(id: string, businessId: string): Promise<OrderMutationResult> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      console.error('[repo:orders] cancel error:', error);
      return { ok: false, ...classifyError(error) };
    }
    if (!data || data.length === 0) {
      console.error('[repo:orders] cancel silent fail — 0 filas. id=', id);
      return {
        ok: false,
        code: 'not_pending',
        message: 'Este pedido ya no se puede cancelar.',
      };
    }

    eventsRepo.track(businessId, 'order_cancelled');
    return { ok: true };
  },

  // deliver(id, { paid, accountId, deliveredOn }) llega en Fase 2A.2 junto
  // con la RPC `deliver_order` — la conversión atómica pedido→transaction
  // NO se implementa en cliente a propósito (riesgo R1/R2 del plan).
};
