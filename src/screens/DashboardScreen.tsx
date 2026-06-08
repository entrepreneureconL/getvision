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

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text as RNText,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { businessesRepo } from '../repos/businesses';
import { transactionsRepo, type DashboardKPIs } from '../repos/transactions';
import { productsRepo, type StockSummary } from '../repos/products';
import { hoursLogRepo, type HoursSummary } from '../repos/hoursLog';
import { analyticsRepo, type MetricResultWithPeriod, type MetricMeta } from '../repos/analytics';
import type { Period } from '../utils/periods';
import {
  getDashboardConfig,
  type Business,
} from '../utils/businessProfile';
import { getDetailLevel } from '../schemas/business';
import Money, { formatMoney } from '../components/Money';
import HeroMetricCard   from '../components/HeroMetricCard';
import Container        from '../components/Container';
import FAB              from '../components/FAB';
import TransactionList  from '../components/TransactionList';
import SaleForm         from '../components/SaleForm';
import CostForm         from '../components/CostForm';
import MovementForm     from '../components/MovementForm';
import QuickProductForm from '../components/QuickProductForm';
import QuickHoursForm   from '../components/QuickHoursForm';
import type { Transaction } from '../schemas/transaction';
import {
  Heading,
  Text,
  Stack,
  SegmentedControl,
  color as token,
  space,
  radius,
} from '../design';

type Modal_ = null | 'sales' | 'costs' | 'movements' | 'product' | 'hours' | 'picker';

type Props = {
  onSignOut: () => void;
  onOpenSettings: () => void;
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

export default function DashboardScreen({ onSignOut, onOpenSettings }: Props) {
  const [business, setBusiness]               = useState<Business | null>(null);
  const [businessId, setBusinessId]           = useState('');
  const [kpis, setKpis]                       = useState<DashboardKPIs>(EMPTY_KPIS);
  const [stock, setStock]                     = useState<StockSummary>(EMPTY_STOCK);
  const [hours, setHours]                     = useState<HoursSummary>(EMPTY_HOURS);
  const [heroMetric, setHeroMetric]           = useState<MetricResultWithPeriod | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [activeModal, setActiveModal]         = useState<Modal_>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [period, setPeriod]                   = useState<Period>('month');
  /** F1-D Task #11: si está seteada, los forms se abren en modo edit. */
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  /** Carga selectiva: hero + meta para un período específico. Liviano. */
  const loadHeroForPeriod = useCallback(async (biz: Business, p: Period) => {
    const hero = await analyticsRepo.getHeroMetricForPeriod(biz, p);
    setHeroMetric(hero);
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

      // F1-D fix: ambos modos cargan 10 movimientos recientes.
      // En simple antes era 3 → causaba "lista incompleta" cuando el contador
      // del hero metric ("4 ventas") no coincidía con lo visible.
      const recentLimit = 10;

      const [monthKPIs, stockSummary, hoursSummary, hero, recent] = await Promise.all([
        needKPIs ? transactionsRepo.getKPIsForCurrentMonth(biz.id) : Promise.resolve(EMPTY_KPIS),
        needStock ? productsRepo.getStockSummary(biz.id) : Promise.resolve(EMPTY_STOCK),
        needHours ? hoursLogRepo.getSummaryForCurrentMonth(biz.id) : Promise.resolve(EMPTY_HOURS),
        analyticsRepo.getHeroMetricForPeriod(biz, period),
        transactionsRepo.listRecent(biz.id, recentLimit),
      ]);

      setKpis(monthKPIs);
      setStock(stockSummary);
      setHours(hoursSummary);
      setHeroMetric(hero);
      setRecentTransactions(recent);
    } catch (e) {
      console.error('[Dashboard] loadDashboardData error:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  /** Cambio de período en el SegmentedControl — recargamos SOLO heroMetric. */
  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    if (business) loadHeroForPeriod(business, next);
  };

  const closeModal = () => {
    setActiveModal(null);
    setShowMoreOptions(false);
    setEditingTransaction(null);
    loadDashboardData();
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
        />
      </>
    );
  };

  // ───── Sección modo simple (F1-D) ─────

  const renderSimpleSection = () => (
    <>
      {/* SegmentedControl Día/Semana/Mes — debajo de la HeroMetricCard. */}
      <View style={{ marginTop: space['4'] }}>
        <SegmentedControl<Period>
          value={period}
          onChange={handlePeriodChange}
          options={[
            { value: 'day', label: 'Día' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
          ]}
        />
      </View>

      {/* Sub-info contextual (F1-E parcial). */}
      {subInfoText.length > 0 ? (
        <Text
          variant="caption"
          color="tertiary"
          align="center"
          style={{ marginTop: space['3'], marginBottom: space['2'] }}
        >
          {subInfoText}
        </Text>
      ) : null}

      {/* Lista de movimientos */}
      {recentTransactions.length === 0 ? (
        <View style={{ marginTop: space['5'] }}>
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
        </View>
      ) : (
        <View style={{ marginTop: space['5'] }}>
          <Text variant="micro" color="secondary" uppercase style={{ marginBottom: space['2'] }}>
            Últimos movimientos
          </Text>
          <TransactionList
            transactions={recentTransactions}
            limit={10}
            showEmptyState={false}
            onItemPress={handleTransactionPress}
          />
        </View>
      )}

      <TouchableOpacity
        style={{ paddingVertical: space['4'], marginTop: space['4'] }}
        onPress={onOpenSettings}
        activeOpacity={0.7}
      >
        <Text variant="caption" color="accent" align="center">
          ¿Querés ver tu negocio con más detalle? Activá modo detallado en Ajustes ↗
        </Text>
      </TouchableOpacity>
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

          <TouchableOpacity
            style={[styles.pickerItem, { borderLeftColor: '#27AE60' }]}
            onPress={() => { setShowMoreOptions(false); setActiveModal('sales'); }}
            activeOpacity={0.75}
          >
            <RNText style={styles.pickerIcon}>💰</RNText>
            <View style={styles.pickerTextWrap}>
              <RNText style={styles.pickerItemTitle}>Cobrar</RNText>
              <RNText style={styles.pickerItemSub}>Lo que entró a tu negocio</RNText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pickerItem, { borderLeftColor: '#E67E22' }]}
            onPress={() => { setShowMoreOptions(false); setActiveModal('costs'); }}
            activeOpacity={0.75}
          >
            <RNText style={styles.pickerIcon}>🛒</RNText>
            <View style={styles.pickerTextWrap}>
              <RNText style={styles.pickerItemTitle}>Pagar</RNText>
              <RNText style={styles.pickerItemSub}>Lo que gastaste</RNText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pickerItem, { borderLeftColor: '#2E86C1' }]}
            onPress={() => { setShowMoreOptions(false); setActiveModal('hours'); }}
            activeOpacity={0.75}
          >
            <RNText style={styles.pickerIcon}>⏱</RNText>
            <View style={styles.pickerTextWrap}>
              <RNText style={styles.pickerItemTitle}>Horas trabajadas</RNText>
              <RNText style={styles.pickerItemSub}>El tiempo que le dedicaste</RNText>
            </View>
          </TouchableOpacity>

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
                <RNText style={styles.pickerIcon}>📦</RNText>
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
                <RNText style={styles.pickerIcon}>↔️</RNText>
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
        <Container>

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
              <TouchableOpacity onPress={onOpenSettings} activeOpacity={0.7}>
                <RNText style={styles.settingsIcon}>⚙️</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { await supabase.auth.signOut(); onSignOut(); }}
              >
                <Text variant="caption" color="tertiary">Salir</Text>
              </TouchableOpacity>
            </Stack>
          </Stack>

          {/* Hero metric — con comparativa solo en modo simple */}
          {heroMetric && (
            <HeroMetricCard
              metric={heroMetric}
              contextualNote={balanceContextualNote}
              comparison={detailLevel === 'simple' ? heroMetric.comparison : null}
              previousLabel={detailLevel === 'simple' ? heroMetric.previousLabel : undefined}
            />
          )}

          {/* Modo simple o detailed */}
          {detailLevel === 'simple' ? renderSimpleSection() : renderDetailedKPIs()}

        </Container>
      </ScrollView>

      <FAB onPress={openPicker} />
      {renderActionPicker()}

      {activeModal === 'sales' && businessId.length > 0 && (
        <SaleForm
          businessId={businessId}
          transaction={editingTransaction ?? undefined}
          onSuccess={closeModal}
          onClose={() => { setActiveModal(null); setEditingTransaction(null); }}
        />
      )}
      {activeModal === 'costs' && businessId.length > 0 && (
        <CostForm
          businessId={businessId}
          transaction={editingTransaction ?? undefined}
          onSuccess={closeModal}
          onClose={() => { setActiveModal(null); setEditingTransaction(null); }}
        />
      )}
      {activeModal === 'movements' && businessId.length > 0 && (
        <MovementForm businessId={businessId} onSuccess={closeModal} onClose={() => setActiveModal(null)} />
      )}

      <QuickProductForm
        businessId={businessId}
        visible={activeModal === 'product'}
        onClose={() => setActiveModal(null)}
        onSuccess={closeModal}
      />
      <QuickHoursForm
        businessId={businessId}
        visible={activeModal === 'hours'}
        onClose={() => setActiveModal(null)}
        onSuccess={closeModal}
      />
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
  settingsIcon: { fontSize: 20 },

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
  pickerIcon:        { fontSize: 22, width: 28, textAlign: 'center' },
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
