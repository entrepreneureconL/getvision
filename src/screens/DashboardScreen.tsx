/**
 * DashboardScreen — pantalla principal.
 *
 * F1-D refactor (modo simple):
 *   - Header compacto con avatar + saludo + nombre + ⚙.
 *   - HeroMetricCard rediseñada (sin border lateral, hero 44px).
 *   - SegmentedControl Día/Semana/Mes debajo de la card → cambia heroMetric
 *     (carga current + previous + comparativa).
 *   - Sub-info contextual ("X ventas · Yh · Z días activos") como línea única.
 *   - TransactionList denso con dividers (no card por item).
 *   - Hint "modo detallado" se mantiene.
 *
 * Modo detailed: mantiene estructura legacy de F0 (KPI cards, Split, Balance).
 * Lo refactorizamos cuando le toque (#6 o más adelante).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text as RNText,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { businessesRepo } from '../repos/businesses';
import { transactionsRepo, type DashboardKPIs } from '../repos/transactions';
import { productsRepo, type StockSummary } from '../repos/products';
import { hoursLogRepo, type HoursSummary } from '../repos/hoursLog';
import { analyticsRepo, type MetricResultWithPeriod, type MetricMeta, type MiPlataSnapshot, type MonthFlowResult, type CalendarDay } from '../repos/analytics';
import { categoriesRepo } from '../repos/categories';
import type { CategoryOverride } from '../schemas/categoryOverride';
import { resolveRange, shiftMonthISO, parseLocalISODate, todayLocalISO, type Period, type StockPeriod, type DashboardRange } from '../utils/periods';
import type { HistoryFilter } from '../utils/historyFilters';
import {
  getContextualHint,
  shouldShowCostsFirst,
  type ContextualHint as Hint,
} from '../utils/anticipation';
import { eventsRepo } from '../repos/events';
import ContextualHintBanner from '../components/ContextualHint';
import {
  getDashboardConfig,
  type Business,
} from '../utils/businessProfile';
import {
  getDetailLevel,
  getIncomeBreakdownAxis,
  getExpenseBreakdownAxis,
  type BreakdownAxis,
} from '../schemas/business';
import Money, { formatMoney } from '../components/Money';
import HeroMetricCard   from '../components/HeroMetricCard';
import MiPlataCard      from '../components/MiPlataCard';
import FlowPairSection  from '../components/FlowPairSection';
import PeriodBalanceCard from '../components/PeriodBalanceCard';
import Container        from '../components/Container';
import FAB              from '../components/FAB';
import TransactionList  from '../components/TransactionList';
import SaleForm         from '../components/SaleForm';
import CostForm         from '../components/CostForm';
import MovementForm     from '../components/MovementForm';
import QuickProductForm from '../components/QuickProductForm';
// RESERVED: Horas — for Estadísticas page and Chofer profile
// import QuickHoursForm   from '../components/QuickHoursForm';
import OrderForm        from '../components/OrderForm';
import OrdersDayList    from '../components/OrdersDayList';
import type { Transaction } from '../schemas/transaction';
import type { Order } from '../schemas/order';
import {
  Heading,
  Text,
  Stack,
  Card,
  Button,
  SegmentedControl,
  CalendarMonth,
  CalendarMonthExpanded,
  ModalShell,
  color as token,
  space,
  radius,
  breakpoint,
} from '../design';

type Modal_ = null | 'sales' | 'costs' | 'movements' | 'product' | 'hours' | 'picker' | 'order' | 'ordersDay';

type Props = {
  onOpenSettings: () => void;
  /** F1-M.4 — abre la HistoryScreen con un filtro pre-armado. */
  onOpenHistory: (filter: HistoryFilter) => void;
};

const EMPTY_KPIS: DashboardKPIs = {
  income: 0, expenses: 0, balance: 0,
  serviceIncome: 0, productIncome: 0, count: 0,
};
const EMPTY_STOCK: StockSummary = {
  totalProducts: 0, totalStockUnits: 0,
  lowStockCount: 0, stockValueAtCost: 0,
};
const EMPTY_HOURS: HoursSummary = {
  totalHours: 0, billableHours: 0,
  estimatedRevenue: 0, entries: 0,
};

/**
 * G-1 (GETVISION_DESIGN, 2026-06-10) — selector de período ÚNICO.
 * Antes había DOS relojes en pantalla: Hoy/Semana/Mes/Año dentro de MiPlata
 * y Día/Semana/Mes para el bloque flow. Ahora un solo SegmentedControl
 * gobierna TODO lo que está debajo; MiPlata deriva su StockPeriod de acá.
 * "Año" migra a la futura tab Stats (F1-D #8).
 */
const STOCK_OF: Record<Period, StockPeriod> = {
  day: 'today',
  week: 'week',
  month: 'month',
  year: 'year', // D-6: el dashboard no ofrece 'year' en su selector, pero el tipo lo exige
};

/** Opciones del selector único de período (G-1). */
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

/** Saludo según hora del día. Pequeño detalle de calidez. */
function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Construye la línea de sub-info ("12 ventas · 30h · 3 días activos").
 *  Omite las partes con valor 0 para no mostrar "0 ventas". */
function buildSubInfo(meta: MetricMeta): string {
  const parts: string[] = [];
  if (meta.salesCount > 0) {
    parts.push(`${meta.salesCount} ${meta.salesCount === 1 ? 'venta' : 'ventas'}`);
  }
  if (meta.hoursTotal > 0) {
    const h = formatMoney(meta.hoursTotal).replace(',00', '');
    parts.push(`${h}h trabajadas`);
  }
  if (meta.activeDays > 0) {
    const plural = meta.activeDays === 1 ? 'día activo' : 'días activos';
    parts.push(`${meta.activeDays} ${plural}`);
  }
  return parts.join('  ·  ');
}

export default function DashboardScreen({ onOpenSettings, onOpenHistory }: Props) {
  // D-15: ancho reactivo — en web responde al resize del navegador. Por debajo
  // del breakpoint: una columna (layout validado con Screen Time). Por encima:
  // dos columnas estilo dashboard web (ref. CoinMarketCap). Fuente única del
  // umbral: `breakpoint.wide` del DS (mismo que usa MainTabs para el sidebar).
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= breakpoint.wide;
  const [business, setBusiness]               = useState<Business | null>(null);
  const [businessId, setBusinessId]           = useState('');
  const [kpis, setKpis]                       = useState<DashboardKPIs>(EMPTY_KPIS);
  const [stock, setStock]                     = useState<StockSummary>(EMPTY_STOCK);
  const [hours, setHours]                     = useState<HoursSummary>(EMPTY_HOURS);
  const [heroMetric, setHeroMetric]           = useState<MetricResultWithPeriod | null>(null);
  /** F1-M Fase B — Snapshot de MiPlata con current + previous + delta.
   *  G-1: su período se deriva del selector unificado (`STOCK_OF[period]`). */
  const [miPlataSnapshot, setMiPlataSnapshot] = useState<MiPlataSnapshot | null>(null);
  /** F1-M.2 — Ingresos + Costos del período con doble desglose. Solo modo simple. */
  const [monthFlow, setMonthFlow]             = useState<MonthFlowResult | null>(null);
  /** F1-M.2 — eje del toggle Canal/Etiqueta. Optimistic en setter, persiste a businesses. */
  const [incomeAxis, setIncomeAxis]           = useState<BreakdownAxis>('channel');
  const [expenseAxis, setExpenseAxis]         = useState<BreakdownAxis>('channel');
  /** F1-L — overrides del business, pasados a TransactionList para que customs muestren su label/icon real. */
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverride[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [activeModal, setActiveModal]         = useState<Modal_>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [period, setPeriod]                   = useState<Period>('month');
  /** F1-O / D-19.b — rango custom del calendario. null = gobierna el chip `period`. */
  const [customRange, setCustomRange]         = useState<{ start: string; end: string } | null>(null);
  /** F1-O / D-19 — agregado del mes calendario para el widget <CalendarMonth/>. */
  const [calendarDays, setCalendarDays]       = useState<CalendarDay[]>([]);
  /** D-23.a — mes que muestra el calendario ('YYYY-MM-DD', día 1). Empieza en el
   *  mes de hoy; los chevrons ‹ › lo desplazan. Es solo qué mes se DIBUJA — no es
   *  el filtro (el filtro vive en period/customRange; preserva G-1, un solo reloj). */
  const [calendarAnchor, setCalendarAnchor]   = useState(todayLocalISO());
  /** F1-O / D-19.c — móvil: el calendario arranca colapsado (no come ~300px). */
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  /** D-23.b1 — vista EXPANDIDA del calendario (`<CalendarMonthExpanded/>`). En
   *  escritorio ocupa el ancho de las 2 columnas; en móvil abre full-screen
   *  (ModalShell). Distinta de `calendarExpanded` (mostrar/ocultar el compacto
   *  inline en móvil). */
  const [expandedCalendar, setExpandedCalendar] = useState(false);
  /** F1-D Task #11: si está seteada, los forms se abren en modo edit. */
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  /** F1-O/D-21.a — pedido en edición (OrderForm modo edit). */
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  /** F1-O/D-21.a — día cuya agenda de pedidos está abierta (OrdersDayList). */
  const [ordersDayDate, setOrdersDayDate] = useState<string | null>(null);
  /** D-5 — keys de hints descartados en ESTA sesión (sin persistencia v1). */
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);

  // ── D-5: anticipación nivel 1 ──
  // Hint contextual por hora/día + señal "¿registró algo hoy?" de las
  // transactions ya cargadas (cero queries extra).
  const hasTransactionsToday = useMemo(
    () => recentTransactions.some(t => t.date === todayLocalISO()),
    [recentTransactions],
  );
  const hint = useMemo(
    () => getContextualHint({ hasTransactionsToday }),
    [hasTransactionsToday],
  );
  const visibleHint = hint && !dismissedHints.includes(hint.key) ? hint : null;

  const handleHintAction = (h: Hint) => {
    if (businessId) eventsRepo.track(businessId, 'hint_tap', { key: h.key });
    setDismissedHints(prev => [...prev, h.key]);
    if (h.action === 'open_sale') setActiveModal('sales');
    else if (h.action === 'open_picker') setActiveModal('picker');
    else if (h.action === 'switch_week') handlePeriodChange('week');
  };

  // Orden del picker por frecuencia (F1-K.2 intacto: solo orden, nada se
  // esconde ni compacta — mismo modo pedagógico para todos).
  const costsFirst = useMemo(
    () => shouldShowCostsFirst(recentTransactions),
    [recentTransactions],
  );

  // F1-O / D-19.b — qué resalta el calendario: el rango custom si está activo, o
  // el reflejo del chip (día/semana). 'Mes' = sin banda (estado default suave).
  const calendarSelection = useMemo(() => {
    if (customRange) return customRange;
    if (period === 'month') return null;
    const r = resolveRange(period);
    return { start: r.start, end: r.end };
  }, [customRange, period]);

  /** Carga selectiva: hero + meta para un período específico. Liviano. */
  const loadHeroForPeriod = useCallback(async (biz: Business, p: Period) => {
    const hero = await analyticsRepo.getHeroMetricForPeriod(biz, p);
    setHeroMetric(hero);
  }, []);

  /**
   * F1-M.2 + F1-O/D-19.b — Carga selectiva de Flow + MiPlata para la selección
   * activa: un chip (Period) o un rango custom del calendario (DashboardRange).
   * Para el chip, MiPlata usa su StockPeriod; para el rango, ambos toman el rango.
   */
  const loadSelection = useCallback(async (biz: Business, sel: Period | DashboardRange) => {
    // Issue 2 — la lista "Últimos movimientos" sigue la selección activa (un
    // solo reloj, G-1): se carga acotada al MISMO rango que Flow + MiPlata.
    const range = typeof sel === 'string' ? resolveRange(sel) : sel;
    const [flow, snap, movements] = await Promise.all([
      analyticsRepo.getMonthFlow(biz.id, sel),
      analyticsRepo.getMiPlataSnapshot(biz.id, typeof sel === 'string' ? STOCK_OF[sel] : sel),
      transactionsRepo.listRecentByRange(biz.id, range.start, range.end, 10),
    ]);
    setMonthFlow(flow);
    setMiPlataSnapshot(snap);
    setRecentTransactions(movements);
  }, []);

  /** D-23.a — Carga el mes calendario de un ancla. Owner único de `calendarDays`
   *  (el efecto de abajo lo dispara al montar y al navegar; closeModal lo refresca
   *  tras una escritura). Memoizado por mes en analyticsRepo → navegar ida/vuelta
   *  no re-consulta. */
  const loadCalendarMonth = useCallback(async (bizId: string, anchor: string) => {
    const days = await analyticsRepo.getCalendarMonth(bizId, anchor);
    setCalendarDays(days);
  }, []);

  /** Carga completa del dashboard. Usa el `period` actual del state para hero.
   *  Sin period en deps: el cambio de período NO dispara full reload. */
  const loadDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const biz = await businessesRepo.ensureForUser(user.id);
      if (!biz) return;

      setBusiness(biz);
      setBusinessId(biz.id);

      const detailLevel = getDetailLevel(biz);
      const model = biz.income_model ?? 'mixed';

      const needStock = detailLevel === 'detailed' && model !== 'services';
      const needHours = detailLevel === 'detailed' && model !== 'products';
      const needKPIs  = detailLevel === 'detailed';
      const needFlow  = detailLevel === 'simple';  // F1-M.2: MonthFlowCard solo en simple
      // F1-M Fase A (A1): la HeroMetricCard ("Tu hora rinde", "Daily revenue", etc.)
      // migra a la futura tab Estadísticas. En el dashboard simple ya no se muestra
      // porque MiPlata + Ingresos/Costos cubren la respuesta "¿cómo va mi negocio?".
      const needHero  = detailLevel === 'detailed';

      // F1-D fix: ambos modos cargan 10 movimientos recientes.
      // En simple antes era 3 → causaba "lista incompleta" cuando el contador
      // del hero metric ("4 ventas") no coincidía con lo visible.
      const recentLimit = 10;
      // Issue 2 — la lista sigue el filtro. En el mount (period inicial 'month',
      // sin customRange) = el mes actual. Tras una escritura con un filtro custom
      // activo, closeModal sobre-escribe vía loadSelection (este callback usa el
      // period inicial por su memo []).
      const recentRange = resolveRange(period);

      const [monthKPIs, stockSummary, hoursSummary, hero, recent, snap, overrides, flow] = await Promise.all([
        needKPIs ? transactionsRepo.getKPIsForCurrentMonth(biz.id) : Promise.resolve(EMPTY_KPIS),
        needStock ? productsRepo.getStockSummary(biz.id) : Promise.resolve(EMPTY_STOCK),
        needHours ? hoursLogRepo.getSummaryForCurrentMonth(biz.id) : Promise.resolve(EMPTY_HOURS),
        needHero ? analyticsRepo.getHeroMetricForPeriod(biz, period) : Promise.resolve(null),
        transactionsRepo.listRecentByRange(biz.id, recentRange.start, recentRange.end, recentLimit),
        analyticsRepo.getMiPlataSnapshot(biz.id, STOCK_OF[period]),  // F1-M Fase B + G-1
        categoriesRepo.listForBusiness(biz.id),  // F1-L
        needFlow ? analyticsRepo.getMonthFlow(biz.id, period) : Promise.resolve(null),  // F1-M.2
      ]);
      // F1-O / D-19 + D-23.a — el mes calendario lo carga el efecto dedicado
      // (owner único de calendarDays), keyed por `calendarAnchor`. Así la
      // navegación de mes y el refresh post-escritura quedan consistentes.

      setKpis(monthKPIs);
      setStock(stockSummary);
      setHours(hoursSummary);
      setHeroMetric(hero);
      setRecentTransactions(recent);
      setMiPlataSnapshot(snap);
      setCategoryOverrides(overrides);
      setMonthFlow(flow);

      // F1-M.2 — sincronizar ejes con la preferencia del business.
      setIncomeAxis(getIncomeBreakdownAxis(biz));
      setExpenseAxis(getExpenseBreakdownAxis(biz));
    } catch (e) {
      console.error('[Dashboard] loadDashboardData error:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // D-23.a — El calendario (solo modo simple) se recarga al montar y cada vez
  // que el ancla cambia (navegación de mes). Owner único de `calendarDays`.
  useEffect(() => {
    if (!businessId || !business) return;
    if (getDetailLevel(business) !== 'simple') return;
    loadCalendarMonth(businessId, calendarAnchor);
  }, [businessId, business, calendarAnchor, loadCalendarMonth]);

  /** D-23.a — Navegación de mes (chevrons ‹ ›). Solo cambia el ancla (el efecto
   *  recarga); NO toca el filtro activo (period/customRange) — preserva G-1.
   *  Telemetría F1-N: solo la dirección, sin fechas. */
  const handleCalendarNav = (delta: 'prev' | 'next') => {
    setCalendarAnchor(prev => shiftMonthISO(prev, delta === 'prev' ? -1 : 1));
    if (businessId) eventsRepo.track(businessId, 'calendar_nav', { delta });
  };

  /** D-23.a — "Hoy": vuelve el calendario al mes actual. No altera el filtro. */
  const handleCalendarToday = () => setCalendarAnchor(todayLocalISO());

  /** D-23.b1 — ampliar/contraer la vista del calendario. Escritorio: full-width
   *  sobre las 2 columnas; móvil: full-screen (ModalShell). No toca el filtro
   *  (preserva G-1). Telemetría F1-N: solo el flag, sin fechas. */
  const handleExpandCalendar = () => {
    setExpandedCalendar(true);
    if (businessId) eventsRepo.track(businessId, 'calendar_expand', { expanded: true });
  };
  const handleContractCalendar = () => {
    setExpandedCalendar(false);
    if (businessId) eventsRepo.track(businessId, 'calendar_expand', { expanded: false });
  };

  /**
   * D-23.b1 — clic en la celda de NETO semanal de la vista expandida → filtra el
   * dashboard a ESA semana (pedido CEO 2026-06-13: "para filtrar ingresos y
   * salidas y verla en detalle"). Reusa la maquinaria de rango como el tap-tap;
   * el rango resalta la semana en la grilla. resolveRange/MiPlata cuentan solo
   * lo ya ocurrido, así que incluir días futuros de la fila es inofensivo.
   */
  const handleWeekPress = (weekStart: string, weekEnd: string) => {
    const range = { start: weekStart, end: weekEnd };
    setCustomRange(range);
    if (business) loadSelection(business, resolveRange(range));
    if (businessId) eventsRepo.track(businessId, 'calendar_filter', { kind: 'week' });
  };

  /**
   * D-23.a — "Ver [mes]": filtra el dashboard al MES COMPLETO que muestra el
   * calendario, de un toque (sin tap-tap entre fechas). Reusa la maquinaria de
   * rango: `resolveRange('month', anchor)` da el mes completo + comparativa
   * contra el mes anterior + label de mes (no un rango de fechas suelto). El
   * customRange resultante resalta el mes en la grilla. Cero IT (P-010).
   */
  const handleViewMonth = () => {
    const range = resolveRange('month', parseLocalISODate(calendarAnchor));
    setCustomRange({ start: range.start, end: range.end });
    if (business) loadSelection(business, range);
    if (businessId) eventsRepo.track(businessId, 'calendar_filter', { kind: 'month' });
  };

  /** Cambio de período en el SegmentedControl ÚNICO (G-1) — recarga flow +
   *  MiPlata en simple, hero en detailed. Un reloj, todo sincronizado. */
  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    setCustomRange(null);  // G-1: un solo reloj — el chip limpia el rango del calendario.
    if (!business) return;
    const detail = getDetailLevel(business);
    if (detail === 'detailed') loadHeroForPeriod(business, next);
    if (detail === 'simple') loadSelection(business, next);
  };

  /**
   * F1-O / D-19.b — tap en un día del calendario. Máquina tap-tap: sin rango (o
   * con rango ya armado) → día único; con día único previo → segundo tap arma el
   * rango ordenado. El rango custom gobierna Mi Plata + Balance/flujo vía
   * resolveRange, y des-selecciona los chips (el calendario NO es un 2º reloj).
   */
  const handleCalendarDayPress = (date: string) => {
    // F1-O/D-21.a — un día (hoy o futuro) con pedidos abre la AGENDA del día,
    // no el filtro: lo accionable ahí es "Entregar" (spec DESIGN §4.7.bis).
    // El filtro de "hoy" sigue viviendo en el chip del SegmentedControl.
    // Días futuros sin pedidos: no-op (ADR #20 — el futuro no tiene plata).
    const todayISO = todayLocalISO();
    if (date >= todayISO) {
      const day = calendarDays.find(d => d.date === date);
      if ((day?.ordersCount ?? 0) > 0) {
        setOrdersDayDate(date);
        setActiveModal('ordersDay');
        return;
      }
      if (date > todayISO) return;
    }
    const next = !customRange || customRange.start !== customRange.end
      ? { start: date, end: date }
      : customRange.start <= date
        ? { start: customRange.start, end: date }
        : { start: date, end: customRange.start };
    setCustomRange(next);
    if (business) loadSelection(business, resolveRange(next));
    // F1-O/D-19.c — telemetría F1-N: solo el kind, sin fechas ni montos.
    if (businessId) {
      eventsRepo.track(businessId, 'calendar_filter', {
        kind: next.start === next.end ? 'day' : 'range',
      });
    }
  };

  /**
   * F1-M.2 — Toggle Canal/Etiqueta por bloque. Optimistic + persiste a Supabase.
   * Si la migration no fue aplicada en DB, el patch fallará (columna inexistente)
   * y revertimos el axis local a su valor previo. El componente sigue funcionando
   * sin persistencia hasta que se corra `F1-M.2_breakdown_axis_migration.sql`.
   */
  const handleIncomeAxisChange = async (next: BreakdownAxis) => {
    const previous = incomeAxis;
    setIncomeAxis(next);
    if (!business) return;
    const updated = await businessesRepo.update(business.id, { income_breakdown_axis: next });
    if (updated) setBusiness(updated);
    else setIncomeAxis(previous);
  };

  const handleExpenseAxisChange = async (next: BreakdownAxis) => {
    const previous = expenseAxis;
    setExpenseAxis(next);
    if (!business) return;
    const updated = await businessesRepo.update(business.id, { expense_breakdown_axis: next });
    if (updated) setBusiness(updated);
    else setExpenseAxis(previous);
  };

  const closeModal = () => {
    setActiveModal(null);
    setShowMoreOptions(false);
    setEditingTransaction(null);
    setEditingOrder(null);
    setOrdersDayDate(null);
    // F1-O: la memo del calendario es estable por mes → invalidar tras una
    // escritura para traer los agregados frescos. D-23.a: refrescar el mes
    // ANCLADO (no necesariamente el de hoy), que es el owner del efecto.
    if (businessId) {
      analyticsRepo.invalidateCalendarMonth(businessId);
      loadCalendarMonth(businessId, calendarAnchor);
    }
    // Issue 2 — tras una escritura, recargar respetando el filtro ACTIVO
    // (customRange || period). `loadDashboardData` usa el período inicial (memo
    // []); en modo simple sobre-escribimos Flow/MiPlata/movimientos con la
    // selección vigente. Corrige además el revert pre-existente de Flow/MiPlata
    // a "mes" cuando había un rango custom activo.
    loadDashboardData().then(() => {
      if (business && getDetailLevel(business) === 'simple') {
        loadSelection(business, customRange ? resolveRange(customRange) : period);
      }
    });
  };

  /**
   * Tap en item de la lista → abre el form correspondiente en modo edit.
   * Solo income/expense regulares. Extraordinarios no editables hoy (deuda chica,
   * habría que rediseñar MovementForm para soportarlo).
   */
  const handleTransactionPress = (t: Transaction) => {
    if (t.type === 'income') {
      setEditingTransaction(t);
      setActiveModal('sales');
    } else if (t.type === 'expense') {
      setEditingTransaction(t);
      setActiveModal('costs');
    }
    // income_extraordinary / expense_extraordinary: no-op por ahora.
  };

  const openPicker = () => {
    setShowMoreOptions(false);
    setActiveModal('picker');
  };

  const config = business
    ? getDashboardConfig(business)
    : getDashboardConfig({ id: '', name: 'Mi Negocio' });

  const businessName = business?.name ?? 'Mi Negocio';
  const detailLevel = business ? getDetailLevel(business) : 'simple';
  const rubroLabel = business?.subrubro || business?.rubro || null;

  // Nota contextual extra para monthly_balance (mantiene el comportamiento F0).
  const balanceContextualNote = (() => {
    if (!heroMetric || heroMetric.spec.key !== 'monthly_balance' || heroMetric.isEmpty) {
      return undefined;
    }
    if (heroMetric.value > 0) return 'Este mes te quedaron a favor. ¡Buen trabajo!';
    if (heroMetric.value < 0) return 'Los costos superaron los ingresos este mes.';
    return 'Mes parejo — ni ganancia ni pérdida.';
  })();

  const subInfoText = heroMetric ? buildSubInfo(heroMetric.meta) : '';

  // F1-K.2 revertido (decisión CEO 2026-06-10): el picker del FAB es genérico
  // para todos los usuarios — siempre modo simple (items grandes con subtítulo
  // pedagógico). La adaptación por experiencia queda para el panel, no para el
  // botón. Si en F2 se valida que algún usuario prefiere el modo compacto,
  // volver como toggle en Settings (ver TECH §9.14).

  // ───── Sección modo detailed (legacy F0 — pendiente refactor) ─────

  const renderDetailedKPIs = () => {
    const healthColor = kpis.balance < 0 ? '#C0392B' : '#27AE60';
    const healthLabel = kpis.balance < 0 ? '🔴 Alerta' : kpis.balance === 0 ? '⚪ Neutro' : '🟢 Saludable';
    const healthBg    = kpis.balance < 0 ? '#1E0808' : kpis.balance === 0 ? '#141422' : '#081A0F';

    return (
      <>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#27AE60' }]}>
            <RNText style={styles.kpiLabel}>💰 Ingresos</RNText>
            <RNText style={[styles.kpiValue, { color: '#27AE60' }]}>$ {formatMoney(kpis.income)}</RNText>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#E67E22' }]}>
            <RNText style={styles.kpiLabel}>📋 Costos</RNText>
            <RNText style={[styles.kpiValue, { color: '#E67E22' }]}>$ {formatMoney(kpis.expenses)}</RNText>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {config.showStockKPI && (
            <TouchableOpacity
              style={[styles.kpiCardTappable, { borderLeftColor: '#9B59B6' }]}
              onPress={() => setActiveModal('product')}
              activeOpacity={0.75}
            >
              <View style={styles.kpiHeaderRow}>
                <RNText style={styles.kpiLabel}>📦 Stock</RNText>
                {stock.lowStockCount > 0 && (
                  <View style={styles.kpiBadge}>
                    <RNText style={styles.kpiBadgeText}>{stock.lowStockCount} bajo</RNText>
                  </View>
                )}
              </View>
              {stock.totalProducts === 0 ? (
                <RNText style={styles.kpiEmpty}>Tocá para agregar</RNText>
              ) : (
                <>
                  <RNText style={[styles.kpiValue, { color: '#9B59B6' }]}>{stock.totalProducts}</RNText>
                  <RNText style={styles.kpiSub}>{formatMoney(stock.stockValueAtCost)} a costo</RNText>
                </>
              )}
            </TouchableOpacity>
          )}

          {config.showHoursKPI && (
            <TouchableOpacity
              style={[styles.kpiCardTappable, { borderLeftColor: '#2E86C1' }]}
              onPress={() => setActiveModal('hours')}
              activeOpacity={0.75}
            >
              <View style={styles.kpiHeaderRow}>
                <RNText style={styles.kpiLabel}>⏱ Horas mes</RNText>
                {hours.billableHours < hours.totalHours && (
                  <View style={[styles.kpiBadge, { borderColor: '#7F8C8D' }]}>
                    <RNText style={[styles.kpiBadgeText, { color: '#7F8C8D' }]}>
                      {formatMoney(hours.totalHours - hours.billableHours)} no fact.
                    </RNText>
                  </View>
                )}
              </View>
              {hours.entries === 0 ? (
                <RNText style={styles.kpiEmpty}>Tocá para registrar</RNText>
              ) : (
                <>
                  <RNText style={[styles.kpiValue, { color: '#2E86C1' }]}>{formatMoney(hours.totalHours)}h</RNText>
                  <RNText style={styles.kpiSub}>{formatMoney(hours.billableHours)}h facturables</RNText>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {config.showSplitRevenue && (
          <View style={styles.splitCard}>
            <RNText style={styles.splitTitle}>Composición de ingresos</RNText>
            <View style={styles.splitBar}>
              <View style={[styles.splitBarA, { flex: kpis.serviceIncome }]} />
              <View style={[styles.splitBarB, { flex: kpis.productIncome }]} />
            </View>
          </View>
        )}

        <View style={[styles.balanceCard, { backgroundColor: healthBg }]}>
          <View style={styles.balanceRow}>
            <View>
              <RNText style={styles.balanceLabel}>Resultado del mes</RNText>
              <Money
                amount={kpis.balance}
                colored
                prefix="$ "
                style={styles.balanceValue}
              />
            </View>
            <View style={[styles.badge, { borderColor: healthColor }]}>
              <RNText style={[styles.badgeText, { color: healthColor }]}>{healthLabel}</RNText>
            </View>
          </View>
        </View>

        <Text variant="micro" color="secondary" uppercase style={{ marginTop: space['2'], marginBottom: space['2'] }}>
          Últimos movimientos
        </Text>
        <TransactionList
          transactions={recentTransactions}
          limit={10}
          emptyMessage="Sin movimientos este mes. Usá el botón + para empezar."
          onItemPress={handleTransactionPress}
          categoryOverrides={categoryOverrides}
        />
      </>
    );
  };

  // ───── Sección modo simple (F1-D) ─────

  // F1-M Fase A (A3 revertido tras feedback CEO 2026-06-09):
  // La heurística inicial ("mostrar bloque flow solo si hay pendientes") era
  // demasiado agresiva — ocultaba la métrica "¿cuánto entré este mes?" y el
  // Balance, no solo la duplicación visual del desglose por canal. El usuario
  // SIN pendientes igual quiere ver Ingresos / Costos / Balance del período.
  //
  // La duplicación real ("Efectivo/MP/Banco en MiPlata Y en Ingresos") se va a
  // resolver con default axis='category' cuando no hay pendientes (Fase posterior)
  // y/o con el bar chart de Fase C que cambia la lectura visual.
  // D-15: la sección simple se descompone en bloques que se COMPONEN distinto
  // según el ancho: una columna en móvil (orden validado con Screen Time),
  // dos columnas en escritorio (referencia CoinMarketCap — feedback CEO).
  // Mismos componentes, misma data; cambia solo la disposición.

  // F1-O / D-19 — widget calendario (escritorio; móvil colapsable = 1D).
  // D-23.a — ancla navegable + "Hoy" (solo si el ancla no es el mes actual).
  const calendarIsCurrentMonth = calendarAnchor.slice(0, 7) === todayLocalISO().slice(0, 7);

  /** D-23.a/b1 — controles bajo el calendario (compacto o expandido): chip de
   *  rango activo con "Limpiar" + botón "Ver [mes]" para filtrar el mes pasado
   *  completo de un toque. Compartido por ambas vistas (DRY). */
  const renderCalendarFooterControls = () => {
    // D-23.a — "Ver [mes]": un toque para filtrar el mes pasado COMPLETO (sin
    // tap-tap entre fechas — pedido CEO). Solo para meses PASADOS (el actual ya
    // lo cubre el chip "Mes"; el futuro no tiene plata que ver). Se oculta si el
    // mes mostrado ya es el rango filtrado (evita el botón redundante).
    const calendarIsPastMonth = calendarAnchor.slice(0, 7) < todayLocalISO().slice(0, 7);
    const anchorMonth = resolveRange('month', parseLocalISODate(calendarAnchor));
    const customIsAnchorMonth =
      customRange != null &&
      customRange.start === anchorMonth.start &&
      customRange.end === anchorMonth.end;
    const showViewMonth = calendarIsPastMonth && !customIsAnchorMonth;
    const monthName = parseLocalISODate(calendarAnchor).toLocaleString('es-AR', { month: 'long' });

    return (
      <>
        {customRange ? (
          <Stack direction="row" justify="space-between" align="center" style={{ marginTop: space['3'] }}>
            <Text variant="caption" color="secondary">{resolveRange(customRange).label}</Text>
            <TouchableOpacity
              onPress={() => handlePeriodChange('month')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text variant="caption" color="accent">Limpiar ✕</Text>
            </TouchableOpacity>
          </Stack>
        ) : null}
        {showViewMonth ? (
          <View style={{ alignItems: 'center', marginTop: space['3'] }}>
            <Button variant="primary" size="sm" onPress={handleViewMonth}>
              {`Ver ${monthName}`}
            </Button>
          </View>
        ) : null}
      </>
    );
  };

  const renderCalendar = () => (
    <Card variant="surface" padding="lg">
      <CalendarMonth
        anchor={calendarAnchor}
        today={todayLocalISO()}
        days={calendarDays}
        selection={calendarSelection}
        onDayPress={handleCalendarDayPress}
        onPrevMonth={() => handleCalendarNav('prev')}
        onNextMonth={() => handleCalendarNav('next')}
        onToday={calendarIsCurrentMonth ? undefined : handleCalendarToday}
        onExpand={handleExpandCalendar}
        formatMoney={formatMoney}
      />
      {renderCalendarFooterControls()}
    </Card>
  );

  /** D-23.b1 — vista expandida (montos por día + neto semanal + totales del mes).
   *  Misma data y mismos handlers que el compacto; el clic en la celda semanal
   *  filtra esa semana (handleWeekPress). El padre gobierna la selección. */
  const renderCalendarExpanded = () => (
    <Card variant="surface" padding="lg">
      <CalendarMonthExpanded
        anchor={calendarAnchor}
        today={todayLocalISO()}
        days={calendarDays}
        selection={calendarSelection}
        onDayPress={handleCalendarDayPress}
        onWeekPress={handleWeekPress}
        onPrevMonth={() => handleCalendarNav('prev')}
        onNextMonth={() => handleCalendarNav('next')}
        onToday={calendarIsCurrentMonth ? undefined : handleCalendarToday}
        onContract={handleContractCalendar}
      />
      {renderCalendarFooterControls()}
    </Card>
  );

  /** D-23.b2 — móvil: la vista expandida abre full-screen sobre un ModalShell
   *  (reusa backdrop/Esc/back del DS). Scroll interno por si la grilla + footer
   *  no entran. El ícono "contraer" de la cabecera cierra. */
  const renderCalendarModalMobile = () => (
    <ModalShell
      visible={!isWide && expandedCalendar}
      onClose={handleContractCalendar}
      placement="sheet"
    >
      <View style={styles.calModalPanel}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderCalendarExpanded()}
        </ScrollView>
      </View>
    </ModalShell>
  );

  const renderMiPlata = () =>
    miPlataSnapshot ? (
      <MiPlataCard
        snapshot={miPlataSnapshot}
        onPendingPress={() => setActiveModal('movements')}
        onChannelPress={(account) =>
          onOpenHistory({
            type: 'all',
            axis: 'channel',
            key: account.id,
            label: account.name,
            period,
          })
        }
      />
    ) : null;

  const renderFlowHero = () =>
    monthFlow ? (
      <PeriodBalanceCard
        income={monthFlow.income.total}
        expense={monthFlow.expense.total}
        period={period}
        series={monthFlow.series}
        prevDailyAvgIncome={monthFlow.prevDailyAvgIncome}
        prevIncome={monthFlow.income.previousTotal}
        prevExpense={monthFlow.expense.previousTotal}
        prevLabel={monthFlow.prevLabel}
      />
    ) : null;

  const renderFlowPair = () =>
    monthFlow ? (
      <FlowPairSection
        flow={monthFlow}
        period={period}
        incomeAxis={incomeAxis}
        expenseAxis={expenseAxis}
        onIncomeAxisChange={handleIncomeAxisChange}
        onExpenseAxisChange={handleExpenseAxisChange}
        onLinePress={(kind, key, label) =>
          onOpenHistory({
            type: kind,
            axis: kind === 'income' ? incomeAxis : expenseAxis,
            key,
            label,
            period,
          })
        }
      />
    ) : null;

  const renderMovimientos = () => {
    // Issue 2 — la lista sigue el filtro activo (calendario/selector). Con filtro,
    // el título refleja el rango y el vacío dice "en este período" (no el
    // onboarding "cargá tu primer movimiento", que solo aplica al default "Mes").
    const rangeLabel = customRange
      ? resolveRange(customRange).label
      : period !== 'month'
        ? resolveRange(period).label
        : null;
    const isFiltered = rangeLabel != null;
    const heading = isFiltered ? `Movimientos · ${rangeLabel}` : 'Últimos movimientos';

    if (recentTransactions.length === 0) {
      // Default vacío = negocio sin movimientos → onboarding. Filtrado vacío =
      // el período no tiene movimientos (pero el negocio sí puede tener otros).
      return isFiltered ? (
        <View>
          <Text variant="micro" color="secondary" uppercase style={{ marginBottom: space['2'] }}>
            {heading}
          </Text>
          <View style={{
            backgroundColor: token.bg.raised,
            borderRadius: radius.lg,
            padding: space['5'],
            alignItems: 'center',
          }}>
            <Text variant="caption" color="secondary" align="center">
              Sin movimientos en este período.
            </Text>
          </View>
        </View>
      ) : (
        <Stack gap="2" align="center" style={{
          backgroundColor: token.bg.raised,
          borderRadius: radius.lg,
          padding: space['6'],
        }}>
          <Heading level={4} align="center">
            Cargá tu primer movimiento para empezar
          </Heading>
          <Text variant="caption" color="secondary" align="center">
            Usá el botón + abajo a la derecha cuando cobres, pagues o trabajes.
          </Text>
        </Stack>
      );
    }

    return (
      <View>
        <Text variant="micro" color="secondary" uppercase style={{ marginBottom: space['2'] }}>
          {heading}
        </Text>
        <TransactionList
          transactions={recentTransactions}
          limit={10}
          showEmptyState={false}
          onItemPress={handleTransactionPress}
          categoryOverrides={categoryOverrides}
        />
      </View>
    );
  };

  const renderDetailHint = () => (
    <TouchableOpacity
      style={{ paddingVertical: space['4'], marginTop: space['4'] }}
      onPress={onOpenSettings}
      activeOpacity={0.7}
    >
      <Text variant="caption" color="accent" align="center">
        ¿Querés ver tu negocio con más detalle? Activá modo detallado en Ajustes ↗
      </Text>
    </TouchableOpacity>
  );

  const renderSimpleSection = () =>
    isWide ? (
      // ── Escritorio (D-15): dos columnas. Izquierda = plata y flujo
      //    (MiPlata + Ingresos/Costos); derecha = historia (Balance con
      //    gráfico + últimos movimientos). El ojo lee F: estado → relato.
      <>
        {/* D-23.b1 — expandido: ocupa el ancho de las 2 columnas, sobre la
            grilla. El compacto sale de la columna izquierda mientras tanto. */}
        {expandedCalendar ? (
          <View style={{ marginTop: space['4'] }}>{renderCalendarExpanded()}</View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: space['4'],
            alignItems: 'flex-start',
            marginTop: space['4'],
          }}
        >
          <Stack gap="3" style={{ flex: 5 }}>
            {expandedCalendar ? null : renderCalendar()}
            {renderMiPlata()}
            {renderFlowPair()}
          </Stack>
          <Stack gap="3" style={{ flex: 7 }}>
            {renderFlowHero()}
            {renderMovimientos()}
          </Stack>
        </View>
        {renderDetailHint()}
      </>
    ) : (
      // ── Móvil/tablet: una columna (orden G-3 validado).
      <>
        <View style={{ marginTop: space['3'] }}>{renderMiPlata()}</View>
        <Stack gap="3" style={{ marginTop: space['3'] }}>
          {renderFlowHero()}
          {renderFlowPair()}
        </Stack>
        <View style={{ marginTop: space['5'] }}>{renderMovimientos()}</View>
        {renderDetailHint()}
      </>
    );

  // ───── Action picker (igual que F0) ─────

  const renderActionPicker = () => (
    <Modal
      visible={activeModal === 'picker'}
      animationType="slide"
      transparent
      onRequestClose={() => { setActiveModal(null); setShowMoreOptions(false); }}
    >
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.handle} />
          <RNText style={styles.pickerTitle}>¿Qué querés registrar?</RNText>

          {/* Modo simple genérico para todos (items grandes con subtítulo
              pedagógico). F1-K.2 compacto revertido — decisión CEO 2026-06-10.
              D-5: solo cambia el ORDEN según frecuencia de uso (nada se
              esconde): si registrás más costos que ventas, "Pagar" sube. */}
          {(costsFirst
            ? (['costs', 'sales'] as const)
            : (['sales', 'costs'] as const)
          ).map((kind, index) => {
            const isSale = kind === 'sales';
            const accent = isSale ? token.success.base : token.warning.base;
            const showFrequentTag = index === 0 && recentTransactions.length >= 5;
            return (
              <TouchableOpacity
                key={kind}
                style={[styles.pickerItem, { borderLeftColor: accent }]}
                onPress={() => { setShowMoreOptions(false); setActiveModal(kind); }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isSale ? 'cash-outline' : 'cart-outline'}
                  size={22}
                  color={accent}
                  style={styles.pickerIcon}
                />
                <View style={styles.pickerTextWrap}>
                  <RNText style={styles.pickerItemTitle}>
                    {isSale ? 'Cobrar' : 'Pagar'}
                  </RNText>
                  <RNText style={styles.pickerItemSub}>
                    {isSale ? 'Lo que entró a tu negocio' : 'Lo que gastaste'}
                  </RNText>
                </View>
                {showFrequentTag ? (
                  <RNText style={styles.pickerFrequentTag}>frecuente</RNText>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {/* F1-O/D-21.a — pedidos de clientes: la palabra del usuario es
              "Pedido" (naming spec §4.7.bis). Violeta `info` para coincidir con
              los badges de pedidos del calendario (§4.9.b). [Item 2] */}
          <TouchableOpacity
            style={[styles.pickerItem, { borderLeftColor: token.info.base }]}
            onPress={() => { setShowMoreOptions(false); setActiveModal('order'); }}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-number-outline" size={22} color={token.info.base} style={styles.pickerIcon} />
            <View style={styles.pickerTextWrap}>
              <RNText style={styles.pickerItemTitle}>Pedido</RNText>
              <RNText style={styles.pickerItemSub}>Te encargaron algo con fecha de entrega</RNText>
            </View>
          </TouchableOpacity>

          {/* RESERVED: Horas — for Estadísticas page and Chofer profile
          <TouchableOpacity
            style={[styles.pickerItem, { borderLeftColor: token.info.base }]}
            onPress={() => { setShowMoreOptions(false); setActiveModal('hours'); }}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={22} color={token.info.base} style={styles.pickerIcon} />
            <View style={styles.pickerTextWrap}>
              <RNText style={styles.pickerItemTitle}>Horas trabajadas</RNText>
              <RNText style={styles.pickerItemSub}>El tiempo que le dedicaste</RNText>
            </View>
          </TouchableOpacity>
          */}

          <TouchableOpacity
            style={styles.moreToggle}
            onPress={() => setShowMoreOptions(v => !v)}
            activeOpacity={0.7}
          >
            <RNText style={styles.moreToggleText}>
              {showMoreOptions ? '▲ Menos opciones' : '▼ Más opciones'}
            </RNText>
          </TouchableOpacity>

          {showMoreOptions && (
            <>
              <TouchableOpacity
                style={[styles.pickerItem, styles.pickerItemSecondary]}
                onPress={() => { setShowMoreOptions(false); setActiveModal('product'); }}
                activeOpacity={0.75}
              >
                <Ionicons name="cube-outline" size={22} color={token.text.secondary} style={styles.pickerIcon} />
                <View style={styles.pickerTextWrap}>
                  <RNText style={styles.pickerItemTitle}>Agregar producto al catálogo</RNText>
                  <RNText style={styles.pickerItemSub}>Configurar lo que vendés con stock</RNText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickerItem, styles.pickerItemSecondary]}
                onPress={() => { setShowMoreOptions(false); setActiveModal('movements'); }}
                activeOpacity={0.75}
              >
                <Ionicons name="swap-horizontal-outline" size={22} color={token.text.secondary} style={styles.pickerIcon} />
                <View style={styles.pickerTextWrap}>
                  <RNText style={styles.pickerItemTitle}>Movimiento extraordinario</RNText>
                  <RNText style={styles.pickerItemSub}>Ingresos o egresos puntuales</RNText>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.pickerCancel}
            onPress={() => { setActiveModal(null); setShowMoreOptions(false); }}
          >
            <RNText style={styles.pickerCancelText}>Cancelar</RNText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Container maxWidth={isWide ? 1160 : undefined}>

          {/* Header — F1-D compacto */}
          <Stack direction="row" align="center" justify="space-between" gap="3" style={{ marginBottom: space['4'] }}>
            <Stack direction="row" align="center" gap="3" style={{ flex: 1 }}>
              <View style={styles.avatar}>
                <RNText style={styles.avatarText}>
                  {businessName.charAt(0).toUpperCase()}
                </RNText>
              </View>
              <Stack gap="0" style={{ flex: 1 }}>
                <Text variant="caption" color="tertiary">{greetingFor()}</Text>
                <Text variant="bodyStrong" numberOfLines={1}>{businessName}</Text>
                {rubroLabel ? (
                  <Text variant="micro" color="accent">{rubroLabel}</Text>
                ) : null}
              </Stack>
            </Stack>

            <Stack direction="row" align="center" gap="3">
              {/* D-3: Ionicons reemplaza emojis de chrome (consistencia cross-platform).
                  Issue 3 (2026-06-13): "Salir" se movió a Perfil (con confirmación);
                  el header solo conserva el acceso a Ajustes. */}
              <TouchableOpacity onPress={onOpenSettings} activeOpacity={0.7}>
                <Ionicons name="settings-outline" size={20} color={token.text.secondary} />
              </TouchableOpacity>
            </Stack>
          </Stack>

          {/* G-1 — el ÚNICO selector de período de la pantalla. Gobierna
              MiPlata + Balance + Ingresos/Costos. Pegado arriba para que el
              usuario entienda que todo lo de abajo responde al mismo reloj. */}
          {/* D-5 — hint contextual (descartable). Solo cuando una regla aplica. */}
          {detailLevel === 'simple' && visibleHint ? (
            <View style={{ marginBottom: space['3'] }}>
              <ContextualHintBanner
                hint={visibleHint}
                onAction={handleHintAction}
                onDismiss={(h) => setDismissedHints(prev => [...prev, h.key])}
              />
            </View>
          ) : null}

          {detailLevel === 'simple' ? (
            <View
              style={{
                marginBottom: space['3'],
                // D-15: en escritorio el selector no se estira al ancho total
                // (480px máx, alineado izquierda — patrón chips CoinMarketCap).
                maxWidth: isWide ? 480 : undefined,
              }}
            >
              {/* F1-O/D-19.b: con rango custom activo, ningún chip queda activo
                  (value fuera de options = sin highlight) — preserva G-1. */}
              {isWide ? (
                // Escritorio: el calendario vive siempre visible en la columna
                // izquierda (renderSimpleSection) — el selector va solo.
                <SegmentedControl<Period>
                  value={customRange ? ('' as Period) : period}
                  onChange={handlePeriodChange}
                  options={PERIOD_OPTIONS}
                />
              ) : (
                // Móvil (D-19.c): el mes entero come ~300px y compite con la
                // respuesta de 5 segundos (principios #1/#6) → colapsado por
                // default, con un toggle calendar-outline junto al selector.
                <>
                  <Stack direction="row" align="center" gap="2">
                    <View style={{ flex: 1 }}>
                      <SegmentedControl<Period>
                        value={customRange ? ('' as Period) : period}
                        onChange={handlePeriodChange}
                        options={PERIOD_OPTIONS}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setCalendarExpanded(e => !e)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: token.bg.raised,
                      }}
                    >
                      <Ionicons
                        name={calendarExpanded ? 'calendar' : 'calendar-outline'}
                        size={20}
                        // Acento si hay filtro activo o el calendario está abierto.
                        color={customRange || calendarExpanded ? token.accent.base : token.text.secondary}
                      />
                    </TouchableOpacity>
                  </Stack>
                  {calendarExpanded ? (
                    <View style={{ marginTop: space['3'] }}>{renderCalendar()}</View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Hero metric — F1-M Fase A: solo en modo detailed. En simple, la
              HeroMetricCard se mueve a la futura tab "Estadísticas". El dashboard
              simple usa Mi Plata + Ingresos/Costos para contestar "¿cómo voy?". */}
          {detailLevel === 'detailed' && heroMetric && (
            <HeroMetricCard
              metric={heroMetric}
              contextualNote={balanceContextualNote}
              comparison={null}
              previousLabel={undefined}
            />
          )}

          {/* Modo simple o detailed */}
          {detailLevel === 'simple' ? renderSimpleSection() : renderDetailedKPIs()}

        </Container>
      </ScrollView>

      <FAB onPress={openPicker} />
      {renderActionPicker()}
      {renderCalendarModalMobile()}

      {activeModal === 'sales' && businessId.length > 0 && (
        <SaleForm
          businessId={businessId}
          rubro={business?.rubro ?? null}
          transaction={editingTransaction ?? undefined}
          onSuccess={closeModal}
          onClose={() => { setActiveModal(null); setEditingTransaction(null); }}
        />
      )}
      {activeModal === 'costs' && businessId.length > 0 && (
        <CostForm
          businessId={businessId}
          rubro={business?.rubro ?? null}
          transaction={editingTransaction ?? undefined}
          onSuccess={closeModal}
          onClose={() => { setActiveModal(null); setEditingTransaction(null); }}
        />
      )}
      {activeModal === 'movements' && businessId.length > 0 && (
        <MovementForm businessId={businessId} onSuccess={closeModal} onClose={() => setActiveModal(null)} />
      )}

      {/* F1-O/D-21.a — pedidos: form de carga/edición + agenda del día. */}
      {activeModal === 'order' && businessId.length > 0 && (
        <OrderForm
          businessId={businessId}
          order={editingOrder ?? undefined}
          onSuccess={closeModal}
          onClose={() => { setActiveModal(null); setEditingOrder(null); }}
        />
      )}
      {activeModal === 'ordersDay' && ordersDayDate != null && businessId.length > 0 && (
        <OrdersDayList
          businessId={businessId}
          dateISO={ordersDayDate}
          onClose={closeModal}
          onEditOrder={(o) => { setEditingOrder(o); setActiveModal('order'); }}
        />
      )}

      <QuickProductForm
        businessId={businessId}
        visible={activeModal === 'product'}
        onClose={() => setActiveModal(null)}
        onSuccess={closeModal}
      />
      {/* RESERVED: Horas — for Estadísticas page and Chofer profile
      <QuickHoursForm
        businessId={businessId}
        visible={activeModal === 'hours'}
        onClose={() => setActiveModal(null)}
        onSuccess={closeModal}
      />
      */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: token.bg.base },
  scroll:    { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 120 },

  /* Header pieces */
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: token.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  /* Picker */
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: token.bg.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2A2A4A', alignSelf: 'center', marginBottom: 16 },

  /* D-23.b2 — panel del calendario expandido en móvil (sheet casi full-screen). */
  calModalPanel: {
    backgroundColor: token.bg.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    alignSelf: 'center',
  },
  pickerTitle: { color: '#FFF', fontSize: 17, fontWeight: 'bold', marginBottom: 18, textAlign: 'center' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#141422',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1C1C30',
    borderLeftWidth: 4,
  },
  pickerItemSecondary: {
    backgroundColor: '#0F0F1A',
    borderColor: '#1C1C30',
    borderLeftWidth: 1,
    borderLeftColor: '#1C1C30',
  },
  pickerIcon:        { width: 28, textAlign: 'center' },
  /** D-5 — tag sutil en la acción más frecuente del picker. */
  pickerFrequentTag: {
    color: token.accent.base,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: token.accent.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pickerTextWrap:    { flex: 1 },
  pickerItemTitle:   { color: '#FFF', fontSize: 14, fontWeight: '600' },
  pickerItemSub:     { color: '#7F8C8D', fontSize: 11, marginTop: 2 },

  moreToggle:        { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  moreToggleText:    { color: token.accent.base, fontSize: 12, fontWeight: '500' },
  pickerCancel:      { paddingVertical: 14, alignItems: 'center', marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A4A' },
  pickerCancelText:  { color: '#7F8C8D', fontSize: 14 },

  /* Modo detailed (legacy F0) */
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiCard: {
    flex: 1, backgroundColor: '#141422',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderLeftWidth: 3,
  },
  kpiCardTappable: {
    flex: 1, backgroundColor: '#141422',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderWidth: 1, borderColor: '#1C1C30',
  },
  kpiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  kpiLabel:     { color: '#7F8C8D', fontSize: 11 },
  kpiValue:     { fontSize: 14, fontWeight: 'bold' },
  kpiSub:       { color: '#7F8C8D', fontSize: 10, marginTop: 2 },
  kpiEmpty:     { color: '#7F8C8D', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  kpiBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#C0392B' },
  kpiBadgeText: { color: '#C0392B', fontSize: 9, fontWeight: '600' },

  splitCard: {
    backgroundColor: '#141422', borderRadius: 10,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#1C1C30',
  },
  splitTitle: { color: '#7F8C8D', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  splitBar:   { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden' },
  splitBarA:  { backgroundColor: '#2E86C1' },
  splitBarB:  { backgroundColor: '#27AE60' },

  balanceCard: {
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#1C1C30',
  },
  balanceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#7F8C8D', fontSize: 11, marginBottom: 3 },
  balanceValue: { fontSize: 20, fontWeight: 'bold' },
  badge:        { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
  badgeText:    { fontSize: 10, fontWeight: '600' },
});
