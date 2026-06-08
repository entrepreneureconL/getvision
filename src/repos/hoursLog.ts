/**
 * hoursLogRepo — acceso a la tabla hours_log.
 *
 * Métricas para el dashboard (hours KPI):
 *   - totalHours: horas trabajadas en el mes actual.
 *   - billableHours: subset que es facturable.
 *   - estimatedRevenue: sum(hours * hourly_rate) para horas facturables.
 *   - entries: cantidad de registros del mes.
 */

import { supabase } from '../lib/supabase';
import {
  parseHoursLog,
  parseHoursLogList,
  HoursLogInsertSchema,
  type HoursLog,
  type HoursLogInsert,
} from '../schemas/hoursLog';

const COLUMNS =
  'id, business_id, date, hours, hourly_rate, description, client_name, billable, created_at';

export type HoursSummary = {
  totalHours: number;
  billableHours: number;
  estimatedRevenue: number;  // de horas billable con rate
  entries: number;
};

const EMPTY_SUMMARY: HoursSummary = {
  totalHours: 0,
  billableHours: 0,
  estimatedRevenue: 0,
  entries: 0,
};

/** Agrega una lista de HoursLog en un HoursSummary. Una sola pasada O(n). */
function aggregateHours(list: HoursLog[]): HoursSummary {
  if (list.length === 0) return EMPTY_SUMMARY;
  const summary: HoursSummary = { ...EMPTY_SUMMARY, entries: list.length };
  for (const h of list) {
    summary.totalHours += h.hours;
    if (h.billable) {
      summary.billableHours += h.hours;
      if (h.hourly_rate) summary.estimatedRevenue += h.hours * h.hourly_rate;
    }
  }
  return summary;
}

export const hoursLogRepo = {
  /** Lista entries de un mes específico, orden por fecha desc. */
  async listByMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<HoursLog[]> {
    const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('hours_log')
      .select(COLUMNS)
      .eq('business_id', businessId)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false });

    if (error) {
      console.error('[repo:hoursLog] listByMonth error:', error);
      return [];
    }
    return parseHoursLogList(data);
  },

  /** Resumen del mes actual para el dashboard. */
  async getSummaryForCurrentMonth(businessId: string): Promise<HoursSummary> {
    const now = new Date();
    const list = await hoursLogRepo.listByMonth(
      businessId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    return aggregateHours(list);
  },

  /**
   * Lista entries en un rango arbitrario [start, end]. F1-D.
   */
  async listByDateRange(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<HoursLog[]> {
    const { data, error } = await supabase
      .from('hours_log')
      .select(COLUMNS)
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('[repo:hoursLog] listByDateRange error:', error);
      return [];
    }
    return parseHoursLogList(data);
  },

  /**
   * Resumen de horas para un rango arbitrario. F1-D.
   */
  async getSummaryForRange(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<HoursSummary> {
    const list = await hoursLogRepo.listByDateRange(businessId, startDate, endDate);
    return aggregateHours(list);
  },

  /** Crear un registro de horas rápido desde el dashboard. */
  async create(input: HoursLogInsert): Promise<HoursLog | null> {
    const parsed = HoursLogInsertSchema.safeParse(input);
    if (!parsed.success) {
      console.error('[repo:hoursLog] create input inválido:', parsed.error.issues);
      return null;
    }

    const { data, error } = await supabase
      .from('hours_log')
      .insert(parsed.data)
      .select(COLUMNS)
      .single();

    if (error) {
      console.error('[repo:hoursLog] create error:', error);
      return null;
    }
    return parseHoursLog(data);
  },
};
