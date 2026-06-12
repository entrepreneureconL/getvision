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
import {
  getPeriodRange,
  getStockPeriodRange,
  resolveRange,
  parseLocalISODate,
  toLocalISODate,
  todayLocalISO,
  type Period,
  type PeriodRange,
  type StockPeriod,
  type DashboardRange,
} from '../utils/periods';
import { supabase } from '../lib/supabase';
import {
  transactionsRepo,
  type DashboardKPIs,
} from './transactions';
import {
  hoursLogRepo,
  type HoursSummary,
} from './hoursLog';
import { productsRepo } from './products';
import { accountsRepo } from './accounts';
import { categoriesRepo } from './categories';
import { resolveCategory } from '../utils/transactionCategories';
import { PENDING_KEY, UNLABELED_KEY } from '../utils/historyFilters';
import type { Business } from '../schemas/business';
import type { Transaction } from '../schemas/transaction';
import type { Product } from '../schemas/product';
import type { Account, AccountKind } from '../schemas/account';
import type { CategoryOverride } from '../schemas/categoryOverride';

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

/**
 * F1-J — Resultado del cálculo "Plata Disponible".
 *
 * Modelo mental:
 *   liquidNow            → lo que YA está en mis cuentas (caja real, devengado
 *                          al pasado: todas las transactions saldadas).
 *   receivablesPending   → lo que está vendido pero todavía no cobrado.
 *   payablesPending      → lo que está comprado pero todavía no pagado.
 *   netAvailable         → escenario "si todo se cumple": liquidNow
 *                          + receivables − payables.
 *
 * No confundir con `monthly_balance` (hero metric):
 *   monthly_balance es devengado del PERÍODO (ingresos − gastos del mes).
 *   AvailableCash es snapshot de stock al momento actual.
 *   Uno es FLUJO, el otro es STOCK. Ambos son verdad.
 */
export type AccountBalance = {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
};

export type AvailableCashResult = {
  liquidNow: number;
  receivablesPending: number;
  payablesPending: number;
  netAvailable: number;
  byAccount: AccountBalance[];
  pendingCount: { receivables: number; payables: number };
};

/**
 * F1-M.2 — Resultado del cálculo "Ingresos / Costos del mes" con composición.
 *
 * `byChannel`  — suma por cuenta donde entró/salió la plata.
 *                Las transactions pendientes (sin account asignada) caen en
 *                la línea sintética con key '__pending'.
 *
 * `byCategory` — suma por etiqueta. Las que no tienen `category` o cuyo value
 *                no resuelve a un CategoryDef conocido caen en key '__unlabeled'.
 *
 * Ambos arrays vienen ordenados por amount desc — el orden visual del bloque
 * es directamente `arr.map(...)` sin más lógica.
 *
 * `percent` ∈ [0,100] del total del bloque. Si total = 0 todos vienen en 0.
 *
 * Los keys sintéticos PENDING_KEY / UNLABELED_KEY viven en `utils/historyFilters`
 * para que `transactionsRepo.listForFilter` los pueda importar sin ciclo.
 */

export type FlowLine = {
  /** Key estable para tap-to-filter (F1-M.4): accountId | category value | sentinel. */
  key: string;
  /** Label visible al usuario. */
  label: string;
  amount: number;
  percent: number;
};

export type FlowBlock = {
  total: number;
  count: number;
  byChannel: FlowLine[];
  byCategory: FlowLine[];
  /** F1-M Fase B — total del período inmediatamente anterior, para comparativa. */
  previousTotal: number;
  previousCount: number;
};

export type MonthFlowResult = {
  income: FlowBlock;
  expense: FlowBlock;
  /** F1-M Fase B — label del período anterior ("ayer", "semana pasada", etc.). */
  prevLabel: string;
  /** D-2 (GETVISION_DESIGN) — serie diaria para el gráfico <PeriodBars/>.
   *  Un punto por día desde el inicio del período hasta HOY (sin días futuros:
   *  una barra en $0 el día 25 cuando todavía es 20 miente). */
  series: FlowSeriesPoint[];
  /** Promedio diario de ingresos del período ANTERIOR — alimenta la línea
   *  punteada "prom" del gráfico ("hoy vs mi normal"). 0 si no hubo. */
  prevDailyAvgIncome: number;
};

/**
 * D-2 — un día del gráfico de barras del período (estilo iOS Screen Time).
 * `label` ya viene listo para el eje: inicial del día en semana ('L','M'...),
 * número de día espaciado en mes ('1','5','10'...), '' en días sin label.
 */
export type FlowSeriesPoint = {
  date: string;
  label: string;
  income: number;
  expense: number;
  isToday: boolean;
};

/**
 * F1-O / D-19 — un día del mes calendario, agregado para el widget
 * <CalendarMonth/>. Estructuralmente compatible con `CalendarDayData` del DS
 * (la screen mapea repo → primitivo).
 *
 * A diferencia de `FlowSeriesPoint` (serie del PERÍODO, corta en hoy), esto es
 * el MES CALENDARIO COMPLETO e independiente del filtro activo: si el usuario
 * filtra "hoy", los puntos del resto del mes no pueden desaparecer (§4.7).
 *
 * `ordersCount` viaja en el tipo desde ya (para que el front pinte marcas de
 * pedidos sin re-trabajo), pero el RPC de Fase 1 es SOLO-PLATA → llega en 0
 * hasta que Fase 2 (entidad `orders`) extienda `get_calendar_month`.
 */
export type CalendarDay = {
  date: string;
  income: number;
  expense: number;
  ordersCount: number;
};

// Caché en memoria del mes calendario, estable salvo escritura. Evita recargar
// en cada cambio de período (el filtro cambia, el mes no). Sin react-query
// todavía (F2) — se invalida con los mismos triggers de reload del dashboard.
// key = `${businessId}:${YYYY-MM}`.
const calendarMonthCache = new Map<string, CalendarDay[]>();

/**
 * F1-M Fase B (refactor B5) — Snapshot de MiPlata con variación neta del período.
 *
 * Tras feedback CEO 2026-06-09 la semántica del card cambió: ya no es STOCK
 * ("cuánto tengo ahora"), pasa a ser FLOW NETO POR CUENTA del período elegido
 * ("cuánto se movió mi plata este período"). Análogo conceptual al bloque
 * Ingresos/Costos del mes, pero desglosado por cuenta y neto (ingresos − costos).
 *
 * Campos:
 *   variation              → variación neta del período (Σ tx ingresos − Σ tx costos).
 *   variationByAccount     → desglose por cuenta. Para chip "Mes" sería:
 *                            Efectivo: -77.000 / MP: +240.000 / Banco: +145.000.
 *   receivablesPending     → solo poblado cuando stockPeriod === 'today'.
 *   payablesPending        → idem.
 *   pendingCount           → idem.
 *   currentLiquidNow       → saldo TOTAL ahora (stock). Sub-info de referencia,
 *                            no protagonista — para que el usuario no pierda
 *                            de vista cuánta plata tiene en total.
 *   delta                  → variación actual vs variación del período anterior.
 *                            `percent` null si la variación previa fue 0.
 *   period / prevLabel     → eco para el UI.
 */
export type AccountVariation = {
  id: string;
  name: string;
  kind: AccountKind;
  variation: number;
};

export type MiPlataSnapshot = {
  variation: number;
  variationByAccount: AccountVariation[];
  receivablesPending: number;
  payablesPending: number;
  pendingCount: { receivables: number; payables: number };
  currentLiquidNow: number;
  delta: { amount: number; percent: number | null };
  /** F1-O / D-19.b — 'custom' cuando el período viene de un rango del calendario. */
  period: StockPeriod | 'custom';
  prevLabel: string;
  /** Label del rango actual; solo poblado cuando period === 'custom'. */
  rangeLabel?: string;
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

/**
 * F1-M.2 — Construye un FlowBlock (Ingresos o Costos) con ambos desgloses
 * precomputados. Puro: recibe data ya cargada, devuelve el objeto agregado.
 *
 * Excluye los `_extraordinary` (igual que `aggregate` de transactionsRepo) —
 * los aportes/retiros/transferencias del dueño no son flujo operativo del mes.
 *
 * Para `byChannel`:
 *   - income  → agrupa por `to_account_id` (donde entró la plata).
 *   - expense → agrupa por `from_account_id` (de dónde salió).
 *   - account ids null (transactions pendientes) → key `PENDING_KEY`.
 *
 * Para `byCategory`:
 *   - agrupa por `category` raw (snake_case del catálogo o de un override).
 *   - `category` null o no resuelta → key `UNLABELED_KEY`.
 */
function buildFlowBlock(
  all: Transaction[],
  previous: Transaction[],
  kind: 'income' | 'expense',
  accountById: Map<string, Account>,
  overrides: CategoryOverride[],
): FlowBlock {
  const filtered = all.filter(t => t.type === kind);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const count = filtered.length;

  // F1-M Fase B — totales del período anterior para la comparativa.
  // No necesitamos composición histórica — solo el total agregado.
  const previousFiltered = previous.filter(t => t.type === kind);
  const previousTotal = previousFiltered.reduce((s, t) => s + t.amount, 0);
  const previousCount = previousFiltered.length;

  const channelMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const t of filtered) {
    // ── byChannel ──
    const accountId = kind === 'income' ? t.to_account_id : t.from_account_id;
    const channelKey = accountId ?? PENDING_KEY;
    channelMap.set(channelKey, (channelMap.get(channelKey) ?? 0) + t.amount);

    // ── byCategory ──
    const categoryKey = t.category && t.category.length > 0 ? t.category : UNLABELED_KEY;
    categoryMap.set(categoryKey, (categoryMap.get(categoryKey) ?? 0) + t.amount);
  }

  const pendingLabel = kind === 'income' ? 'Pendiente cobro' : 'Pendiente pago';

  const byChannel: FlowLine[] = [...channelMap.entries()]
    .map(([key, amount]) => ({
      key,
      label: key === PENDING_KEY
        ? pendingLabel
        : accountById.get(key)?.name ?? 'Cuenta archivada',
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const byCategory: FlowLine[] = [...categoryMap.entries()]
    .map(([key, amount]) => ({
      key,
      label: key === UNLABELED_KEY
        ? 'Sin etiqueta'
        : resolveCategory(key, overrides)?.label ?? key,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { total, count, byChannel, byCategory, previousTotal, previousCount };
}

/**
 * D-2 (GETVISION_DESIGN) — construye la serie diaria del gráfico de barras.
 * Puro: recibe las transactions YA cargadas por getMonthFlow (cero round-trips
 * extra). Excluye `_extraordinary` igual que buildFlowBlock — el gráfico debe
 * sumar lo mismo que los totales de las cards o miente.
 *
 * Labels por período:
 *   week  → inicial del día (L M X J V S D).
 *   month → número de día solo en 1 y múltiplos de 5 (eje respirable).
 *   year  → D-6: UN punto por MES (12 barras, inicial del mes). Bucket
 *           distinto porque 365 barras diarias no se leen.
 *   day   → 'Hoy' (un solo punto; el caller decide no graficarlo).
 */
function buildFlowSeries(
  transactions: Transaction[],
  seriesKind: Period | 'custom',
  range: Pick<PeriodRange, 'start' | 'end'>,
): FlowSeriesPoint[] {
  if (seriesKind === 'year') {
    const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const incomeByMonth = new Array(12).fill(0);
    const expenseByMonth = new Array(12).fill(0);
    for (const t of transactions) {
      const m = Number(t.date.slice(5, 7)) - 1; // 'YYYY-MM-DD' → 0-11
      if (m < 0 || m > 11) continue;
      if (t.type === 'income') incomeByMonth[m] += t.amount;
      else if (t.type === 'expense') expenseByMonth[m] += t.amount;
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const year = range.start.slice(0, 4);
    // Sin meses futuros — misma regla de honestidad que con los días.
    return Array.from({ length: currentMonth + 1 }, (_, m) => ({
      date: `${year}-${String(m + 1).padStart(2, '0')}-01`,
      label: MONTH_INITIALS[m],
      income: incomeByMonth[m],
      expense: expenseByMonth[m],
      isToday: m === currentMonth,
    }));
  }

  const incomeByDate = new Map<string, number>();
  const expenseByDate = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === 'income') {
      incomeByDate.set(t.date, (incomeByDate.get(t.date) ?? 0) + t.amount);
    } else if (t.type === 'expense') {
      expenseByDate.set(t.date, (expenseByDate.get(t.date) ?? 0) + t.amount);
    }
  }

  const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const today = todayLocalISO();
  const points: FlowSeriesPoint[] = [];

  const cursor = parseLocalISODate(range.start);
  // El período puede terminar a futuro (mes calendario completo) — cortamos en hoy.
  const last = range.end < today ? range.end : today;

  let iso = toLocalISODate(cursor);
  while (iso <= last) {
    let label = '';
    if (seriesKind === 'week') label = WEEKDAY_INITIALS[cursor.getDay()];
    else if (seriesKind === 'day') label = 'Hoy';
    else {
      // 'month' | 'custom' — número de día espaciado (1, 5, 10, …) para un eje
      // respirable. El rango custom del calendario vive dentro de un mes (≤31d).
      const dayNum = cursor.getDate();
      if (dayNum === 1 || dayNum % 5 === 0) label = String(dayNum);
    }
    points.push({
      date: iso,
      label,
      income: incomeByDate.get(iso) ?? 0,
      expense: expenseByDate.get(iso) ?? 0,
      isToday: iso === today,
    });
    cursor.setDate(cursor.getDate() + 1);
    iso = toLocalISODate(cursor);
  }
  return points;
}

/** D-2 — promedio diario de ingresos de un rango ya cargado (línea "prom"). */
function dailyAvgIncome(transactions: Transaction[], start: string, end: string): number {
  const total = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  if (total === 0) return 0;
  const days =
    Math.round(
      (parseLocalISODate(end).getTime() - parseLocalISODate(start).getTime()) /
        86_400_000,
    ) + 1;
  return days > 0 ? total / days : 0;
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

  /**
   * F1-M.2 — Cómputo del "Flow del período" (Ingresos + Costos) con composición
   * por canal Y por etiqueta lista para el toggle del MonthFlowCard.
   *
   * F1-M Fase B — ahora carga también el período anterior para que MonthFlowCard
   * pueda renderizar la línea de comparativa "↑ +$X vs prevLabel" debajo del
   * total. Solo sumas (no composición previa) — el delta es agregado, no por canal.
   *
   * Cost: 4 round-trips paralelos a Supabase (current tx + previous tx + accounts
   * + overrides). Los dos ejes de composición se agregan en una sola pasada por
   * transaction (O(n)).
   */
  async getMonthFlow(
    businessId: string,
    input: Period | DashboardRange,
  ): Promise<MonthFlowResult> {
    // F1-O / D-19.b — acepta un chip (Period) o un rango custom del calendario.
    // Los chips delegan en resolveRange (= getPeriodRange) → cero cambio de
    // comportamiento; el calendario pasa un DashboardRange.
    const range = typeof input === 'string' ? resolveRange(input) : input;
    const seriesKind: Period | 'custom' = typeof input === 'string' ? input : 'custom';

    const [currentTx, previousTx, accounts, overrides] = await Promise.all([
      transactionsRepo.listForFlowByRange(businessId, range.start, range.end),
      transactionsRepo.listForFlowByRange(businessId, range.prevStart, range.prevEnd),
      accountsRepo.listActive(businessId),
      categoriesRepo.listForBusiness(businessId),
    ]);

    const accountById = new Map<string, Account>(accounts.map(a => [a.id, a]));

    return {
      income:  buildFlowBlock(currentTx, previousTx, 'income',  accountById, overrides),
      expense: buildFlowBlock(currentTx, previousTx, 'expense', accountById, overrides),
      prevLabel: range.prevLabel,
      // D-2 — serie para <PeriodBars/>. Computada de las tx ya fetcheadas.
      series: buildFlowSeries(currentTx, seriesKind, range),
      // D-6: para 'year' las barras son MENSUALES → el promedio de referencia
      // también (total ingresos año anterior / 12), no el diario.
      prevDailyAvgIncome:
        seriesKind === 'year'
          ? previousTx
              .filter(t => t.type === 'income')
              .reduce((s, t) => s + t.amount, 0) / 12
          : dailyAvgIncome(previousTx, range.prevStart, range.prevEnd),
    };
  },

  /**
   * F1-J — "Plata Disponible". Calcula el snapshot de stock del business:
   * cuánta plata real hay hoy en las cuentas + lo que falta cobrar − lo que
   * falta pagar. Es el feed del card superior de HeroDualCard (F1-J.5).
   *
   * F1-M Fase B — acepta `asOf` opcional. Cuando se pasa, calcula balances
   * históricos al cierre de esa fecha (vía `accountsRepo.getBalances(asOf)`)
   * y NO incluye pendientes: los pending son una proyección STOCK del presente
   * (lo que cobrarías a futuro) — no aplica a un snapshot del pasado.
   *   - sin asOf  → liquidNow + pendientes + neto proyectado.
   *   - con asOf  → solo liquidNow histórico + byAccount; pending arrays vacíos.
   *
   * Costo: 2-3 round-trips a Supabase (accounts list, balances, pending si aplica).
   */
  async getAvailableCash(businessId: string, asOf?: string): Promise<AvailableCashResult> {
    const accounts = await accountsRepo.listActive(businessId);

    const [balances, pending] = await Promise.all([
      accountsRepo.getBalances(businessId, asOf),
      asOf
        ? Promise.resolve({ receivables: [], payables: [] })
        : transactionsRepo.listPending(businessId),
    ]);

    const byAccount: AccountBalance[] = accounts.map(a => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      balance: balances[a.id] ?? a.initial_balance,
    }));

    const liquidNow = byAccount.reduce((sum, a) => sum + a.balance, 0);
    const receivablesPending = pending.receivables.reduce((s, t) => s + t.amount, 0);
    const payablesPending = pending.payables.reduce((s, t) => s + t.amount, 0);
    const netAvailable = liquidNow + receivablesPending - payablesPending;

    return {
      liquidNow,
      receivablesPending,
      payablesPending,
      netAvailable,
      byAccount,
      pendingCount: {
        receivables: pending.receivables.length,
        payables: pending.payables.length,
      },
    };
  },

  /**
   * F1-M Fase B (refactor B5) — Variación neta de MiPlata para el período.
   *
   * Devuelve la variación TOTAL + por cuenta del rango elegido + comparativa
   * vs el mismo rango del período anterior. Para chip 'today' también incluye
   * pendientes (proyección futura desde el presente). `currentLiquidNow` viaja
   * como sub-info para que el usuario no pierda de vista el saldo stock total.
   *
   * Costo: 4 round-trips paralelos a Supabase (accounts list, current variations,
   * previous variations, pending si aplica, current balances para liquidNow).
   */
  async getMiPlataSnapshot(
    businessId: string,
    input: StockPeriod | DashboardRange,
  ): Promise<MiPlataSnapshot> {
    // F1-O / D-19.b — chip (StockPeriod) o rango custom del calendario. Las
    // variaciones ya se piden por fechas explícitas, así que generalizar es
    // solo resolver el rango de entrada.
    const range = typeof input === 'string' ? getStockPeriodRange(input) : input;

    // Pendientes: SIEMPRE (feedback CEO 2026-06-11). Son stock del presente
    // ("lo que me deben AHORA") — no dependen del período del selector. Antes
    // solo se cargaban en 'today' y el dato desaparecía al cambiar a Semana/Mes.
    const [accounts, currentVar, previousVar, balances, pending] = await Promise.all([
      accountsRepo.listActive(businessId),
      accountsRepo.getVariations(businessId, range.start, range.end),
      accountsRepo.getVariations(businessId, range.prevStart, range.prevEnd),
      accountsRepo.getBalances(businessId),
      transactionsRepo.listPending(businessId),
    ]);

    const variationByAccount: AccountVariation[] = accounts.map(a => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      variation: currentVar[a.id] ?? 0,
    }));

    const variation = variationByAccount.reduce((s, a) => s + a.variation, 0);
    const previousVariation = Object.values(previousVar).reduce((s, v) => s + v, 0);

    const currentLiquidNow = accounts.reduce(
      (s, a) => s + (balances[a.id] ?? a.initial_balance),
      0,
    );

    const receivablesPending = pending.receivables.reduce((s, t) => s + t.amount, 0);
    const payablesPending = pending.payables.reduce((s, t) => s + t.amount, 0);

    const deltaAmount = variation - previousVariation;
    const deltaPercent = previousVariation !== 0
      ? (deltaAmount / Math.abs(previousVariation)) * 100
      : null;

    return {
      variation,
      variationByAccount,
      receivablesPending,
      payablesPending,
      pendingCount: {
        receivables: pending.receivables.length,
        payables: pending.payables.length,
      },
      currentLiquidNow,
      delta: { amount: deltaAmount, percent: deltaPercent },
      period: typeof input === 'string' ? input : 'custom',
      prevLabel: range.prevLabel,
      rangeLabel: typeof input === 'string' ? undefined : input.label,
    };
  },

  /**
   * F1-O / D-19 — agregado del MES CALENDARIO COMPLETO para <CalendarMonth/>.
   *
   * Una sola query agregada (RPC `get_calendar_month`, GROUP BY date) — NO N
   * queries por día. El RPC excluye `_extraordinary` (cuenta lo MISMO que las
   * cards o miente — ADR #20 / paridad con buildFlowBlock) y excluye días
   * futuros (cero plata en el futuro, a nivel de datos). RLS aplica vía
   * SECURITY INVOKER: aunque se pase un business ajeno, devuelve vacío.
   *
   * Memoizado por (businessId, mes): el filtro de período cambia seguido pero el
   * mes no. Llamar `invalidateCalendarMonth(businessId)` tras guardar/editar/
   * saldar para refrescar (lo cablea la integración D-19.b).
   *
   * Fase 1 = solo plata → `ordersCount` viene en 0. Fase 2 extiende el RPC.
   *
   * @param anchor 'YYYY-MM-DD' — cualquier fecha del mes a traer.
   */
  async getCalendarMonth(businessId: string, anchor: string): Promise<CalendarDay[]> {
    const cacheKey = `${businessId}:${anchor.slice(0, 7)}`;
    const cached = calendarMonthCache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase.rpc('get_calendar_month', {
      p_business_id: businessId,
      p_anchor: anchor,
    });

    if (error) {
      console.error('[analytics] getCalendarMonth error:', error);
      return [];
    }

    // DECIMAL puede volver como string desde Postgres — coercer (TECH §11).
    const rows = ((data ?? []) as Array<{
      date: string;
      income: number | string;
      expense: number | string;
    }>).map(r => ({
      date: r.date,
      income: Number(r.income),
      expense: Number(r.expense),
      ordersCount: 0, // Fase 2: el RPC sumará orders_count por día.
    }));

    calendarMonthCache.set(cacheKey, rows);
    return rows;
  },

  /**
   * Invalida la caché del calendario. Sin businessId limpia todo (logout);
   * con businessId limpia solo sus meses. La llama el dashboard tras cada
   * escritura que cambie los agregados (guardar/editar/saldar/entregar).
   */
  invalidateCalendarMonth(businessId?: string): void {
    if (!businessId) {
      calendarMonthCache.clear();
      return;
    }
    for (const key of calendarMonthCache.keys()) {
      if (key.startsWith(`${businessId}:`)) calendarMonthCache.delete(key);
    }
  },
};
