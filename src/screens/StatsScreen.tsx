/**
 * StatsScreen — tab Estadísticas (D-6: versión densa).
 *
 * El Dashboard responde "¿cómo va mi plata?"; Stats responde "¿cómo rinde mi
 * negocio?". Acá vive la densidad de datos estilo CoinMarketCap (referencia
 * CEO §1.bis.3) que el dashboard simple NO debe cargar:
 *
 *   - Selector Semana / Mes / AÑO (el chip "Año" que salió del dashboard en
 *     G-1 encuentra acá su hogar — comparativas anuales con barras por mes).
 *   - Balance del período con gráfico <PeriodBars/> (reusa PeriodBalanceCard).
 *   - Hero metric por subrubro ("Tu hora rinde", "Ticket promedio", etc.).
 *   - Composición por etiqueta con <ProportionList/> (patrón "Most Used" de
 *     Screen Time): en qué se vendió y en qué se gastó, con ranking visual.
 *     Tap en una fila → tab Movimientos filtrada (mismo contrato F1-M.4).
 *
 * Responsive (D-15): en escritorio dos columnas — izquierda rendimiento
 * (hero + ingresos por etiqueta), derecha relato (balance+gráfico + costos).
 * En móvil, una columna en ese mismo orden de lectura.
 *
 * Data: getMonthFlow ya trae todo (totales, byCategory con percent, series).
 * Cero queries nuevas.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  analyticsRepo,
  type MetricResultWithPeriod,
  type MonthFlowResult,
  type FlowBlock,
} from '../repos/analytics';
import { UNLABELED_KEY, type HistoryFilter } from '../utils/historyFilters';
import type { Business } from '../utils/businessProfile';
import type { Period } from '../utils/periods';
import { formatMoney } from '../components/Money';
import HeroMetricCard from '../components/HeroMetricCard';
import PeriodBalanceCard from '../components/PeriodBalanceCard';
import Container from '../components/Container';
import {
  Heading,
  Text,
  Stack,
  Card,
  SegmentedControl,
  ProportionList,
  color,
  space,
  breakpoint,
} from '../design';

type Props = {
  business: Business;
  /** Tap en una etiqueta → tab Movimientos filtrada (lo cablea MainTabs). */
  onOpenHistory?: (filter: HistoryFilter) => void;
};

/** Stats opera en tendencias: sin "Hoy" (eso es del dashboard). */
type StatsPeriod = Extract<Period, 'week' | 'month' | 'year'>;

export default function StatsScreen({ business, onOpenHistory }: Props) {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [metric, setMetric] = useState<MetricResultWithPeriod | null>(null);
  const [flow, setFlow] = useState<MonthFlowResult | null>(null);

  const { width } = useWindowDimensions();
  const isWide = width >= breakpoint.wide;

  const load = useCallback(async (p: StatsPeriod) => {
    const [m, f] = await Promise.all([
      analyticsRepo.getHeroMetricForPeriod(business, p),
      analyticsRepo.getMonthFlow(business.id, p),
    ]);
    setMetric(m);
    setFlow(f);
  }, [business]);

  useEffect(() => { load(period); }, [load, period]);

  const openCategoryHistory = (kind: 'income' | 'expense') =>
    onOpenHistory
      ? (key: string, label: string) =>
          onOpenHistory({ type: kind, axis: 'category', key, label, period })
      : undefined;

  const renderBalance = () =>
    flow ? (
      <PeriodBalanceCard
        income={flow.income.total}
        expense={flow.expense.total}
        period={period}
        series={flow.series}
        prevDailyAvgIncome={flow.prevDailyAvgIncome}
        prevIncome={flow.income.previousTotal}
        prevExpense={flow.expense.previousTotal}
        prevLabel={flow.prevLabel}
      />
    ) : null;

  const renderHero = () =>
    metric ? (
      <HeroMetricCard metric={metric} comparison={null} previousLabel={undefined} />
    ) : null;

  const renderCategoryCard = (kind: 'income' | 'expense') => {
    if (!flow) return null;
    const block: FlowBlock = kind === 'income' ? flow.income : flow.expense;
    const title = kind === 'income' ? 'En qué vendiste' : 'En qué gastaste';
    const tint = kind === 'income' ? color.success.base : color.warning.base;

    return (
      <Card variant="surface" padding="lg">
        <Text variant="micro" color="secondary" uppercase style={{ marginBottom: space['3'] }}>
          {title}
        </Text>
        {block.byCategory.length > 0 ? (
          <>
            <ProportionList
              tint={tint}
              items={block.byCategory.map(line => ({
                key: line.key,
                label: line.label,
                valueLabel: `$ ${formatMoney(line.amount)}`,
                percent: line.percent,
                dimmed: line.key === UNLABELED_KEY,
              }))}
              onItemPress={openCategoryHistory(kind)}
            />
            {onOpenHistory ? (
              <Text variant="micro" color="tertiary" align="center" style={{ marginTop: space['3'] }}>
                Tocá una etiqueta para ver esos movimientos
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="caption" color="tertiary" align="center">
            Sin {kind === 'income' ? 'ingresos' : 'costos'} este período.
          </Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Container maxWidth={isWide ? 1160 : undefined}>
          <Heading level={2}>Estadísticas</Heading>
          <Text variant="caption" color="tertiary" style={{ marginBottom: space['4'] }}>
            Cómo rinde tu negocio, más allá del día a día.
          </Text>

          <View style={{ maxWidth: isWide ? 480 : undefined }}>
            <SegmentedControl<StatsPeriod>
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'year', label: 'Año' },
              ]}
            />
          </View>

          {isWide ? (
            // ── Escritorio: rendimiento a la izquierda, relato a la derecha ──
            <View
              style={{
                flexDirection: 'row',
                gap: space['4'],
                alignItems: 'flex-start',
                marginTop: space['4'],
              }}
            >
              <Stack gap="3" style={{ flex: 5 }}>
                {renderHero()}
                {renderCategoryCard('income')}
              </Stack>
              <Stack gap="3" style={{ flex: 7 }}>
                {renderBalance()}
                {renderCategoryCard('expense')}
              </Stack>
            </View>
          ) : (
            // ── Móvil: una columna ──
            <Stack gap="3" style={{ marginTop: space['4'] }}>
              {renderBalance()}
              {renderHero()}
              {renderCategoryCard('income')}
              {renderCategoryCard('expense')}
            </Stack>
          )}
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },
  scroll: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 60 },
});
