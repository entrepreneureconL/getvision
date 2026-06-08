/**
 * analyticsRepo — orquestador que calcula la hero metric del business.
 *
 * Arquitectura en 2 capas:
 *
 *   1. COMPUTERS PUROS (funciones exportadas, sin acceso a DB).
 *      Toman datos pre-cargados y devuelven { value, isEmpty, isPartial }.
 *      Son trivialmente testeables — recibís un objeto, devolvés otro.
 *
 *   2. ORQUESTADOR (analyticsRepo).
 *      Resuelve qué métrica corresponde al business, carga lo mínimo necesario
 *      (Promise.all selectivo según métrica), invoca el computer correcto y
 *      arma el MetricResult con el hint construido.
 *
 * F1-D agrega:
 *   - `getHeroMetricForPeriod(business, period)`: igual que getHeroMetricForBusiness
 *     pero parametrizado por Día/Sem/Mes y con comparación al período anterior.
 *   - Computer puro `computePeriodComparison(current, previous)`.
 *   - Meta de soporte para sub-info contextual ("12 ventas · 30 horas · 3 días").
 *
 * Analogía: como tener varias funciones puras de cálculo + un dispatcher.
 * En C++ sería un switch sobre un enum que invoca una función estática por caso.
 * En Python: un dict de strings → callables.
 */

import {
  resolveHeroMetric,
  HERO_METRICS,
  type HeroMetricKey,
  type HeroMetricSpec,
} from '../utils/heroMetrics';
import { getPeriodRange, type Period } from '../utils/periods';
import {
  transactionsRepo,
  type DashboardKPIs,
} from './transactions';
import {
  hoursLogRepo,
  type HoursSummary,
} from './hoursLog';
import { productsRepo } from './products';
import type { Business } from '../schemas/business';
import type { Transaction } from '../schemas/transaction';
import type { Product } from '../schemas/product';

// ────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────

export type ComputeResult = {
  value: number;
  isEmpty: boolean;     // no hay datos suficientes para calcular
  isPartial: boolean;   // hay datos pero faltan dimensiones (e.g., ventas sin horas)
  /**
   * Override conceptual del computer al orquestador: si está definido, el spec
   * mostrado en la UI cambia al de esta key.
   *
   * Caso típico: effective_hourly_rate con balance negativo → tiene sentido
   * cambiar a monthly_balance porque dividir una pérdida por horas trabajadas
   * arroja un número contraintuitivo (más horas → "rate menos malo").
   */
  effectiveKey?: HeroMetricKey;
};

export type MetricResult = ComputeResult & {
  spec: HeroMetricSpec;
  hint: string;
};

/**
 * Comparativa contra el período anterior. F1-D.
 *   - deltaPercent: variación porcentual respecto al valor anterior.
 *     Positivo = creció. Negativo = bajó.
 *   - previousValue: el valor del período anterior (para hover/detalle).
 *
 * NOTA semántica: el signo del delta es matemático, NO de "bueno/malo".
 *   Para monthly_balance / hourly_rate: subir es bueno.
 *   Para cost_to_revenue_ratio: bajar es bueno.
 *   La UI decide el color según el contexto (deuda chica a documentar en F1-E).
 */
export type MetricComparison = {
  deltaPercent: number;
  previousValue: number;
};

/** Meta de soporte para la línea de sub-info del dashboard. F1-E preparado. */
export type MetricMeta = {
  /** Cantidad de income transactions del período. */
  salesCount: number;
  /** Total de horas registradas en el período. */
  hoursTotal: number;
  /** Cantidad de días distintos con al menos un movimiento. */
  activeDays: number;
};

export type MetricResultWithPeriod = MetricResult & {
  period: Period;
  /** Etiqueta del período actual ("Hoy", "Esta semana", "Junio 2026"). */
  periodLabel: string;
  /** Etiqueta del período anterior ("Ayer", "Semana pasada", "Mayo 2026"). */
  previousLabel: string;
  /** Comparativa contra el período anterior. null si no es comparable. */
  comparison: MetricComparison | null;
  /** Contadores secundarios para sub-info. */
  meta: MetricMeta;
};

// Defaults para Promise.all selectivo (cuando una métrica no necesita cierto data).
const EMPTY_HOURS_SUMMARY: HoursSummary = {
  totalHours: 0,
  billableHours: 0,
  estimatedRevenue: 0,
  entries: 0,
};

// ────────────────────────────────────────────────────────────────────
// COMPUTERS PUROS
// ────────────────────────────────────────────────────────────────────

/**
 * Valor efectivo de la hora trabajada: balance neto / horas trabajadas.
 *
 * Casos:
 *   - Sin ventas ni horas → empty
 *   - Con ventas pero sin horas → partial (mostramos balance como fallback)
 *   - Balance negativo → redirige a monthly_balance (mostrar pérdida directa).
 *     Razón: dividir una pérdida por más horas la "achica", lo cual es
 *     matemáticamente correcto pero contraintuitivo. Más horas trabajadas
 *     con pérdida no es "mejor". Para no engañar al usuario, mostramos el
 *     resultado del mes directo.
 *   - Con todo positivo → cálculo real
 */
export function computeEffectiveHourlyRate(
  kpis: DashboardKPIs,
  hoursSummary: HoursSummary,
): ComputeResult {
  if (kpis.count === 0 && hoursSummary.totalHours === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  if (hoursSummary.totalHours === 0) {
    return {
      value: kpis.balance,
      isEmpty: false,
      isPartial: true,
      effectiveKey: kpis.balance < 0 ? 'monthly_balance' : undefined,
    };
  }
  if (kpis.balance < 0) {
    return {
      value: kpis.balance,
      isEmpty: false,
      isPartial: false,
      effectiveKey: 'monthly_balance',
    };
  }
  return {
    value: kpis.balance / hoursSummary.totalHours,
    isEmpty: false,
    isPartial: false,
  };
}

/**
 * Ingreso promedio por día con al menos 1 venta.
 * Cuenta días únicos en los que hubo income.
 */
export function computeDailyRevenue(
  transactions: Transaction[],
  kpis: DashboardKPIs,
): ComputeResult {
  if (kpis.income === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  const uniqueDays = new Set(
    transactions
      .filter(t => t.type === 'income')
      .map(t => t.date),
  );
  if (uniqueDays.size === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  return {
    value: kpis.income / uniqueDays.size,
    isEmpty: false,
    isPartial: false,
  };
}

/**
 * Importe promedio por cliente atendido = ingresos / cantidad de ventas.
 */
export function computeTicketAverage(
  transactions: Transaction[],
  kpis: DashboardKPIs,
): ComputeResult {
  const salesCount = transactions.filter(t => t.type === 'income').length;
  if (salesCount === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  return {
    value: kpis.income / salesCount,
    isEmpty: false,
    isPartial: false,
  };
}

/**
 * Margen promedio del catálogo de productos = avg(unit_price - unit_cost).
 */
export function computeMarginPerSale(products: Product[]): ComputeResult {
  if (products.length === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  const productsWithCost = products.filter(
    p => p.unit_cost != null && p.unit_price != null,
  );
  if (productsWithCost.length === 0) {
    return { value: 0, isEmpty: true, isPartial: true };
  }
  const totalMargin = productsWithCost.reduce(
    (sum, p) => sum + ((p.unit_price ?? 0) - (p.unit_cost ?? 0)),
    0,
  );
  const avgMargin = totalMargin / productsWithCost.length;
  const isPartial = productsWithCost.length < products.length;
  return { value: avgMargin, isEmpty: false, isPartial };
}

/**
 * Ratio costos / ingresos × 100.
 */
export function computeCostToRevenueRatio(kpis: DashboardKPIs): ComputeResult {
  if (kpis.income === 0 && kpis.expenses === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  if (kpis.income === 0) {
    return { value: 100, isEmpty: false, isPartial: true };
  }
  return {
    value: (kpis.expenses / kpis.income) * 100,
    isEmpty: false,
    isPartial: false,
  };
}

/**
 * Balance del mes = income - expenses. Fallback universal.
 */
export function computeMonthlyBalance(kpis: DashboardKPIs): ComputeResult {
  if (kpis.count === 0) {
    return { value: 0, isEmpty: true, isPartial: false };
  }
  return {
    value: kpis.balance,
    isEmpty: false,
    isPartial: false,
  };
}

/**
 * Comparativa de dos ComputeResult del mismo spec.
 *
 * Devuelve null cuando:
 *   - Cualquiera de los dos es empty (sin datos para comparar).
 *   - El valor anterior es 0 (división por cero → "%" indefinido).
 *
 * En cualquier otro caso: deltaPercent = ((current - prev) / |prev|) * 100.
 * El signo es matemático: positivo = creció, negativo = bajó. La interpretación
 * "subir es bueno/malo" depende de la métrica y la decide la UI.
 */
export function computePeriodComparison(
  current: ComputeResult,
  previous: ComputeResult,
): MetricComparison | null {
  if (current.isEmpty || previous.isEmpty) return null;
  if (previous.value === 0) return null;
  const deltaPercent =
    ((current.value - previous.value) / Math.abs(previous.value)) * 100;
  return { deltaPercent, previousValue: previous.value };
}

// ────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ────────────────────────────────────────────────────────────────────

/**
 * Dispatcher único de spec.key → computer. Centralizado acá para que
 * `getHeroMetricForBusiness` y `getHeroMetricForPeriod` no dupliquen el switch.
 */
function runCompute(
  specKey: HeroMetricKey,
  kpis: DashboardKPIs,
  transactions: Transaction[],
  hoursSummary: HoursSummary,
  products: Product[],
): ComputeResult {
  switch (specKey) {
    case 'effective_hourly_rate':
      return computeEffectiveHourlyRate(kpis, hoursSummary);
    case 'daily_revenue':
      return computeDailyRevenue(transactions, kpis);
    case 'ticket_average':
      return computeTicketAverage(transactions, kpis);
    case 'margin_per_sale':
      return computeMarginPerSale(products);
    case 'cost_to_revenue_ratio':
      return computeCostToRevenueRatio(kpis);
    case 'monthly_balance':
      return computeMonthlyBalance(kpis);
  }
}

/** Calcula la meta de sub-info ("12 ventas · 30h · 3 días") para un rango ya cargado. */
function buildMeta(
  transactions: Transaction[],
  kpis: DashboardKPIs,
  hoursSummary: HoursSummary,
): MetricMeta {
  // salesCount: si tenemos raw transactions, las contamos; si no, no sabemos.
  // Cuando el computer no necesitó raw, transactions viene vacío. En ese caso
  // usamos el kpis.count como aproximación (incluye todas).
  const salesCount = transactions.length > 0
    ? transactions.filter(t => t.type === 'income').length
    : 0;

  const activeDays = new Set(transactions.map(t => t.date)).size;

  return {
    salesCount,
    hoursTotal: hoursSummary.totalHours,
    activeDays,
  };
}

// ────────────────────────────────────────────────────────────────────
// ORQUESTADOR
// ────────────────────────────────────────────────────────────────────

export const analyticsRepo = {
  /**
   * Calcula la hero metric para el business en el mes actual.
   * Wrapper de compatibilidad sobre getHeroMetricForPeriod('month'); no expone
   * comparison ni meta para no romper a los callers existentes.
   */
  async getHeroMetricForBusiness(business: Business): Promise<MetricResult> {
    const full = await analyticsRepo.getHeroMetricForPeriod(business, 'month');
    // Devolver solo los campos del MetricResult viejo.
    const { spec, hint, value, isEmpty, isPartial, effectiveKey } = full;
    return { spec, hint, value, isEmpty, isPartial, effectiveKey };
  },

  /**
   * Calcula hero metric para un período (Día / Semana / Mes) e incluye
   * la comparativa contra el período anterior + meta para sub-info.
   *
   * Carga current + previous en paralelo (Promise.all) y dispatchea al
   * mismo computer. Esto evita lógica duplicada y mantiene tiempo de
   * respuesta razonable aunque hagamos 2x queries.
   */
  async getHeroMetricForPeriod(
    business: Business,
    period: Period,
  ): Promise<MetricResultWithPeriod> {
    const spec = resolveHeroMetric(business.rubro, business.subrubro);
    const businessId = business.id;
    const range = getPeriodRange(period);

    // Decidir qué cargar en función de la métrica.
    // raw transactions sirve para daily_revenue, ticket_average Y meta (siempre
    // queremos saber activeDays y salesCount). Para simplificar las queries y
    // dejar la meta funcional, los pedimos siempre.
    const needsHours = spec.key === 'effective_hourly_rate';
    const needsProducts = spec.key === 'margin_per_sale';

    const [
      currentKPIs,
      previousKPIs,
      currentTx,
      previousTx,
      currentHours,
      previousHours,
      products,
    ] = await Promise.all([
      transactionsRepo.getKPIsForRange(businessId, range.start, range.end),
      transactionsRepo.getKPIsForRange(businessId, range.prevStart, range.prevEnd),
      transactionsRepo.listByDateRange(businessId, range.start, range.end),
      transactionsRepo.listByDateRange(businessId, range.prevStart, range.prevEnd),
      needsHours
        ? hoursLogRepo.getSummaryForRange(businessId, range.start, range.end)
        : Promise.resolve(EMPTY_HOURS_SUMMARY),
      needsHours
        ? hoursLogRepo.getSummaryForRange(businessId, range.prevStart, range.prevEnd)
        : Promise.resolve(EMPTY_HOURS_SUMMARY),
      needsProducts
        ? productsRepo.listActive(businessId)
        : Promise.resolve([] as Product[]),
    ]);

    const currentResult = runCompute(spec.key, currentKPIs, currentTx, currentHours, products);
    const previousResult = runCompute(spec.key, previousKPIs, previousTx, previousHours, products);

    // Si el computer pidió un override de display, sustituimos el spec.
    const effectiveSpec = currentResult.effectiveKey
      ? HERO_METRICS[currentResult.effectiveKey]
      : spec;

    const hint = effectiveSpec.buildHint({
      value: currentResult.value,
      isPartial: currentResult.isPartial,
      isEmpty: currentResult.isEmpty,
    });

    const comparison = computePeriodComparison(currentResult, previousResult);
    const meta = buildMeta(currentTx, currentKPIs, currentHours);

    return {
      spec: effectiveSpec,
      hint,
      ...currentResult,
      period,
      periodLabel: range.label,
      previousLabel: range.prevLabel,
      comparison,
      meta,
    };
  },
};
