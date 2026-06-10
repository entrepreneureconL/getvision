/**
 * transactionsRepo — capa de acceso a la tabla `transactions`.
 *
 * Centraliza:
 *   - Las queries más usadas (listByMonth, listRecent).
 *   - El cálculo de KPIs (agregaciones de income/expense).
 *   - El cast DECIMAL→number con zod (antes hacíamos Number(t.amount) a mano).
 *
 * F1-J — Refundación stock-flow:
 *   - settle(id, type, accountId, settledAt): marca una transaction como
 *     saldada (cobrada / pagada) y la asigna a una cuenta.
 *   - listPending(businessId): devuelve receivables (por cobrar) y payables
 *     (por pagar) en una sola pasada.
 *   - update() acepta los nuevos campos (settled_at, from/to_account_id).
 *   - FULL_COLUMNS incluye los nuevos campos para que listRecent/listPending
 *     los devuelvan al UI sin queries extras.
 */

import { supabase } from '../lib/supabase';
import {
  parseTransactionList,
  type Transaction,
  type TransactionType,
} from '../schemas/transaction';
import { resolveCategory } from '../utils/transactionCategories';
import { toLocalISODate } from '../utils/periods';
import { PENDING_KEY, UNLABELED_KEY } from '../utils/historyFilters';
import type { BreakdownAxis } from '../schemas/business';

// Columnas mínimas para KPIs (agregaciones income/expense por categoría).
// No incluyen los campos F1-J porque las KPIs son devengado, no flujo.
const KPI_COLUMNS = 'id, business_id, type, amount, date, category';

// F1-M.2 — columnas necesarias para los bloques Flow del mes (Ingresos/Costos)
// con composición por canal Y por etiqueta. Suma `from_account_id`/`to_account_id`
// al set de KPI; las transactions pendientes vienen con account ids null y caen
// en la línea "Pendiente cobro / pago" del desglose por canal.
const FLOW_COLUMNS =
  'id, business_id, type, amount, date, category, from_account_id, to_account_id';

// Columnas completas: incluyen los campos F1-J. Usadas por listRecent y
// listPending para que el UI tenga toda la info de una sola query.
const FULL_COLUMNS =
  'id, business_id, type, amount, date, payment_method, category, description, status, created_at, settled_at, from_account_id, to_account_id';

/**
 * KPIs agregados que muestra el dashboard.
 * Todo en una sola pasada por la lista (vs filter+reduce 4 veces).
 *
 * Nota F1-J: estos KPIs siguen siendo devengado (cuentan todo lo del período
 * sin importar si está cobrado/pagado). Para "Plata Disponible" hay un
 * cómputo distinto en F1-J.4 (analyticsRepo.computeAvailableCash).
 */
export type DashboardKPIs = {
  income: number;
  expenses: number;
  balance: number;
  serviceIncome: number;
  productIncome: number;
  count: number;
};

/**
 * Helper interno: agrega una lista de transactions en KPIs.
 * Una sola pasada (O(n)), no cuatro filtros como en el dashboard viejo.
 */
function aggregate(transactions: Transaction[]): DashboardKPIs {
  const kpis: DashboardKPIs = {
    income: 0,
    expenses: 0,
    balance: 0,
    serviceIncome: 0,
    productIncome: 0,
    count: transactions.length,
  };

  for (const t of transactions) {
    if (t.type === 'income') {
      kpis.income += t.amount;
      // F1-D fix: resolveCategory mapea strings legacy ("Venta de servicio")
      // y values nuevos ('service_main') al mismo CategoryDef. Antes el match
      // por string crudo fallaba para los registros guardados por SaleForm.
      const cat = resolveCategory(t.category);
      if (cat?.value === 'service_main' || cat?.value === 'service_extra') {
        kpis.serviceIncome += t.amount;
      } else if (cat?.value === 'product') {
        kpis.productIncome += t.amount;
      }
    } else if (t.type === 'expense') {
      kpis.expenses += t.amount;
    }
    // los _extraordinary los ignoramos del balance operativo por ahora.
  }
  kpis.balance = kpis.income - kpis.expenses;
  return kpis;
}

export const transactionsRepo = {
  /**
   * Devuelve todas las transactions del business en un mes específico.
   * year/month son números (month en base 1: enero=1).
   */
  async listByMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]> {
    // Primer y último día del mes en formato YYYY-MM-DD (timezone local).
    const firstDay = toLocalISODate(new Date(year, month - 1, 1));
    const lastDay = toLocalISODate(new Date(year, month, 0));

    const { data, error } = await supabase
      .from('transactions')
      .select(KPI_COLUMNS)
      .eq('business_id', businessId)
      .gte('date', firstDay)
      .lte('date', lastDay);

    if (error) {
      console.error('[repo:transactions] listByMonth error:', error);
      return [];
    }
    return parseTransactionList(data);
  },

  /**
   * KPIs del mes actual. Conveniencia para el dashboard.
   */
  async getKPIsForCurrentMonth(businessId: string): Promise<DashboardKPIs> {
    const now = new Date();
    const list = await transactionsRepo.listByMonth(
      businessId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    return aggregate(list);
  },

  /**
   * Lista raw de transactions del mes actual. La usan los computers de
   * daily_revenue y ticket_average (necesitan ítems individuales, no agregados).
   */
  async listForCurrentMonth(businessId: string): Promise<Transaction[]> {
    const now = new Date();
    return transactionsRepo.listByMonth(
      businessId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
  },

  /**
   * Lista transactions del business en un rango arbitrario [start, end].
   * F1-D: usado por el SegmentedControl Día/Sem/Mes que pide rangos no-calendario.
   * Fechas en formato 'YYYY-MM-DD'.
   */
  async listByDateRange(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(KPI_COLUMNS)
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('[repo:transactions] listByDateRange error:', error);
      return [];
    }
    return parseTransactionList(data);
  },

  /**
   * F1-M.2 — Lista para los bloques Flow del mes (Ingresos/Costos) con
   * composición por canal + etiqueta. Trae los account ids además de los
   * campos KPI estándar. Pendientes (account ids null) caen luego en la
   * línea "Pendiente cobro/pago" del desglose por canal.
   */
  async listForFlowByRange(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(FLOW_COLUMNS)
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('[repo:transactions] listForFlowByRange error:', error);
      return [];
    }
    return parseTransactionList(data);
  },

  /**
   * KPIs agregados de un rango arbitrario. F1-D.
   */
  async getKPIsForRange(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<DashboardKPIs> {
    const list = await transactionsRepo.listByDateRange(businessId, startDate, endDate);
    return aggregate(list);
  },

  /**
   * F1-M.4 — Lista filtrada por canal o etiqueta dentro de un rango.
   *
   * Drivers de uso:
   *   • Tap en una línea de canal del MiPlataCard      → type='all', axis='channel'
   *   • Tap en una línea de canal del MonthFlowCard    → type='income'|'expense', axis='channel'
   *   • Tap en una línea de etiqueta del MonthFlowCard → type='income'|'expense', axis='category'
   *
   * Convenciones del `key`:
   *   axis='channel':
   *     - PENDING_KEY        → tx no settled (settled_at IS NULL)
   *     - accountId UUID     → tx que tienen esa cuenta como source/target
   *   axis='category':
   *     - UNLABELED_KEY      → category IS NULL o category = ''
   *     - category value     → match exacto en la columna `category`
   *
   * Para axis='channel' type='all' y key=accountId el OR cubre los dos lados
   * (income que entró a la cuenta + expense que salió de ella). Ese es el caso
   * "extracto de la cuenta MP" desde el MiPlataCard.
   *
   * Type semántica (alineada con FlowBlock):
   *   'income' / 'expense' filtran al type EXACTO sin extraordinaries — preserva
   *   los números del bloque flow. 'all' incluye todos los types (extraordinaries
   *   inclusive) — sólo lo usa el camino MiPlataCard, donde stock = todo movimiento.
   */
  async listForFilter(
    businessId: string,
    opts: {
      type: 'income' | 'expense' | 'all';
      axis: BreakdownAxis;
      key: string;
      startDate: string;
      endDate: string;
    },
  ): Promise<Transaction[]> {
    let q = supabase
      .from('transactions')
      .select(FULL_COLUMNS)
      .eq('business_id', businessId)
      .gte('date', opts.startDate)
      .lte('date', opts.endDate);

    // Type filter — solo regulares; 'all' = sin filtro.
    if (opts.type === 'income') q = q.eq('type', 'income');
    else if (opts.type === 'expense') q = q.eq('type', 'expense');

    // Axis filter
    if (opts.axis === 'channel') {
      if (opts.key === PENDING_KEY) {
        q = q.is('settled_at', null);
      } else if (opts.type === 'all') {
        // Extracto: la tx tocó esta cuenta como entrada O salida.
        q = q.or(`to_account_id.eq.${opts.key},from_account_id.eq.${opts.key}`);
      } else if (opts.type === 'income') {
        q = q.eq('to_account_id', opts.key);
      } else {
        // expense
        q = q.eq('from_account_id', opts.key);
      }
    } else {
      // axis === 'category'
      if (opts.key === UNLABELED_KEY) {
        // Cubrimos NULL y '' — ambos terminan en UNLABELED_KEY del builder.
        q = q.or('category.is.null,category.eq.');
      } else {
        q = q.eq('category', opts.key);
      }
    }

    q = q
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) {
      console.error('[repo:transactions] listForFilter error:', error);
      return [];
    }
    return parseTransactionList(data);
  },

  /**
   * Actualiza una transaction existente. F1-D (Task #11 — edición).
   * Solo permite tocar campos editables; id, business_id y created_at quedan fuera.
   * Devuelve `true` si la operación pasó por DB sin error.
   *
   * F1-J: acepta los nuevos campos de stock-flow (settled_at, from/to_account_id).
   * Pasar `null` explícito borra el valor (ej. "desmarcar como cobrada").
   */
  async update(
    id: string,
    patch: {
      type?: Transaction['type'];
      amount?: number;
      date?: string;
      payment_method?: string | null;
      category?: string | null;
      description?: string | null;
      status?: 'completed' | 'pending';
      settled_at?: string | null;
      from_account_id?: string | null;
      to_account_id?: string | null;
    },
  ): Promise<boolean> {
    const { error } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id);

    if (error) {
      console.error('[repo:transactions] update error:', error);
      return false;
    }
    return true;
  },

  /**
   * Marca una transaction como saldada (cobrada / pagada).
   * F1-J — esta es la operación principal del "Marcar como cobrada"
   * desde la lista de pendientes.
   *
   * Decide qué columna setear según el type:
   *   - income / income_extraordinary  → to_account_id (entró plata)
   *   - expense / expense_extraordinary → from_account_id (salió plata)
   *
   * Pedimos `type` como parámetro (no lo fetch) porque el caller siempre
   * tiene la transaction completa en memoria (de la lista del dashboard).
   * Evita un round-trip extra a Supabase.
   *
   * En C++ sería el equivalente a una función no-virtual que despacha
   * por enum, sin polimorfismo.
   */
  async settle(
    id: string,
    type: TransactionType,
    accountId: string,
    settledAt: string, // 'YYYY-MM-DD'
  ): Promise<boolean> {
    const isIncome = type === 'income' || type === 'income_extraordinary';
    const patch: Record<string, unknown> = { settled_at: settledAt };
    patch[isIncome ? 'to_account_id' : 'from_account_id'] = accountId;

    const { error } = await supabase
      .from('transactions')
      .update(patch)
      .eq('id', id);

    if (error) {
      console.error('[repo:transactions] settle error:', error);
      return false;
    }
    return true;
  },

  /**
   * Lista las transactions pendientes (settled_at IS NULL) de un business,
   * partidas en receivables (lo que falta cobrar) y payables (lo que falta pagar).
   * F1-J — feed del HeroDualCard y de la futura "Pendientes" tab.
   *
   * Una sola query a Supabase + split en JS. Más simple y barato que dos
   * queries paralelas.
   */
  async listPending(businessId: string): Promise<{
    receivables: Transaction[];
    payables: Transaction[];
  }> {
    const { data, error } = await supabase
      .from('transactions')
      .select(FULL_COLUMNS)
      .eq('business_id', businessId)
      .is('settled_at', null)
      .order('date', { ascending: false });

    if (error) {
      console.error('[repo:transactions] listPending error:', error);
      return { receivables: [], payables: [] };
    }

    const all = parseTransactionList(data);
    const receivables: Transaction[] = [];
    const payables: Transaction[] = [];
    for (const t of all) {
      if (t.type === 'income' || t.type === 'income_extraordinary') {
        receivables.push(t);
      } else if (t.type === 'expense' || t.type === 'expense_extraordinary') {
        payables.push(t);
      }
    }
    return { receivables, payables };
  },

  /**
   * Elimina una transaction por id. F1-D.
   * Devuelve `true` si la operación pasó por DB sin error.
   */
  /**
   * Borra una transaction.
   *
   * Bug detectado: si la policy RLS de la tabla no cubre DELETE, Supabase
   * NO devuelve error — solo afecta 0 filas. El caller pensaba que había
   * borrado y cerraba el modal, pero la fila seguía ahí. Para detectar ese
   * caso silencioso, pedimos `.select('id')` al final: devuelve el array de
   * filas borradas. Si está vacío, alguien (RLS o un row inexistente) lo
   * bloqueó y devolvemos false con un log claro.
   */
  async remove(id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('[repo:transactions] remove error:', error);
      return false;
    }
    if (!data || data.length === 0) {
      console.error(
        '[repo:transactions] remove silent fail — 0 filas afectadas. ' +
        'Revisar policy DELETE en RLS o id inexistente. id=', id,
      );
      return false;
    }
    return true;
  },

  /**
   * Últimos N movimientos del business, ordenados por fecha desc.
   * Para la sección "Últimos movimientos" del dashboard (F0-3).
   * F1-J: ahora devuelve también settled_at y account ids → el UI puede
   * mostrar un chip "Pendiente" sin queries extras.
   */
  async listRecent(
    businessId: string,
    limit: number = 10,
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(FULL_COLUMNS)
      .eq('business_id', businessId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[repo:transactions] listRecent error:', error);
      return [];
    }
    return parseTransactionList(data);
  },
};
