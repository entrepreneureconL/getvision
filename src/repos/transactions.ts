/**
 * transactionsRepo — capa de acceso a la tabla `transactions`.
 *
 * Centraliza:
 *   - Las queries más usadas (listByMonth, listRecent).
 *   - El cálculo de KPIs (agregaciones de income/expense).
 *   - El cast DECIMAL→number con zod (antes hacíamos Number(t.amount) a mano).
 */

import { supabase } from '../lib/supabase';
import {
  parseTransactionList,
  type Transaction,
} from '../schemas/transaction';
import { resolveCategory } from '../utils/transactionCategories';

// Columnas mínimas para KPIs. Si necesitamos más (descripción, payment_method),
// usamos un select más completo en otro método.
const KPI_COLUMNS = 'id, business_id, type, amount, date, category';
const FULL_COLUMNS =
  'id, business_id, type, amount, date, payment_method, category, description, status, created_at';

/**
 * KPIs agregados que muestra el dashboard.
 * Todo en una sola pasada por la lista (vs filter+reduce 4 veces).
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
    // Primer y último día del mes en formato YYYY-MM-DD
    const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

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
   * Actualiza una transaction existente. F1-D (Task #11 — edición).
   * Solo permite tocar campos editables; id, business_id y created_at quedan fuera.
   * Devuelve `true` si la operación pasó por DB sin error.
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
   * Elimina una transaction por id. F1-D.
   * Devuelve `true` si la operación pasó por DB sin error.
   */
  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[repo:transactions] remove error:', error);
      return false;
    }
    return true;
  },

  /**
   * Últimos N movimientos del business, ordenados por fecha desc.
   * Para la sección "Últimos movimientos" del dashboard (F0-3).
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
