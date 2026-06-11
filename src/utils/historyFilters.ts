/**
 * historyFilters.ts — sentinels + tipo de filtro de historial (F1-M.4).
 *
 * Estos viven en un util neutro porque los consumen:
 *   - analyticsRepo.buildFlowBlock     (los emite como keys)
 *   - MonthFlowCard.CompositionLine     (los detecta para estilo especial)
 *   - transactionsRepo.listForFilter    (los interpreta como `IS NULL` queries)
 *   - DashboardScreen / HistoryScreen   (los pasan a través del filtro)
 *
 * Si vivieran en analyticsRepo, transactionsRepo crearía un import circular
 * (analytics ya importa de transactions). Mejor un módulo de utilidad pura.
 */

import type { BreakdownAxis } from '../schemas/business';
import type { Period } from './periods';

/**
 * Key sintética para la línea "Pendiente cobro/pago" del desglose por canal.
 * En la DB, esas tx tienen `settled_at IS NULL` (no se han movido a una cuenta).
 */
export const PENDING_KEY = '__pending';

/**
 * Key sintética para la línea "Sin etiqueta" del desglose por categoría.
 * En la DB, esas tx tienen `category IS NULL` o `category = ''`.
 */
export const UNLABELED_KEY = '__unlabeled';

/**
 * D-4 — key sintética "sin filtro de eje": lista TODO el período.
 * La usa la tab Movimientos (historial completo). `listForFilter` la
 * interpreta como "saltear el filtro de axis".
 */
export const ALL_KEY = '__all';

/**
 * Tipo del filtro que viaja desde el Dashboard hasta la HistoryScreen.
 *
 *   type:
 *     - 'income' / 'expense' → filtra solo income o expense regulares
 *       (sin extraordinaries, consistente con FlowBlock).
 *     - 'all' → todas las tx incluido movements/extraordinaries. Útil para
 *       el caso "extracto de cuenta" cuando se entra por tap en una cuenta
 *       del MiPlataCard.
 *
 *   axis: 'channel' = filtra por cuenta. 'category' = filtra por etiqueta.
 *
 *   key:
 *     - axis='channel'  → accountId, o PENDING_KEY para pendientes.
 *     - axis='category' → category value (snake_case), o UNLABELED_KEY.
 *
 *   label: cómo lo mostramos en el header de la pantalla.
 *   period: rango inicial; el usuario puede cambiarlo desde la propia screen.
 */
export type HistoryFilter = {
  type: 'income' | 'expense' | 'all';
  axis: BreakdownAxis;
  key: string;
  label: string;
  period: Period;
};
