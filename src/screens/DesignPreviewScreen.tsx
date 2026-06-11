/**
 * DesignPreviewScreen — galería de desarrollo del Design System (D-2).
 *
 * Mini-storybook in-house: monta primitivos del DS con datos mock para
 * verificarlos AISLADOS en web y native antes de integrarlos a pantallas
 * reales (regla de paridad — LESSONS #1 / GETVISION_DESIGN §2.7).
 *
 * NO es accesible desde la navegación de la app. Para usarla, en App.tsx
 * cambiar temporalmente el initial screen o montarla directo. No requiere
 * sesión ni Supabase — todo es mock.
 *
 * Hoy muestra: <PeriodBars/> (semana / mes / vacío) + <PeriodBalanceCard/>
 * completa. Sumar acá cada primitivo nuevo del DS.
 */

import { useState } from 'react';
import { ScrollView, View, SafeAreaView, StyleSheet } from 'react-native';
import PeriodBalanceCard from '../components/PeriodBalanceCard';
import FlowPairSection from '../components/FlowPairSection';
import type { BreakdownAxis } from '../schemas/business';
import type { FlowSeriesPoint, MonthFlowResult } from '../repos/analytics';
import {
  Heading,
  Text,
  Card,
  PeriodBars,
  TabBar,
  SideNav,
  color,
  space,
  type TabItem,
} from '../design';

// ── Mock: TabBar (D-4) ──
type PreviewTab = 'home' | 'movements' | 'stats' | 'profile';
const PREVIEW_TABS: TabItem<PreviewTab>[] = [
  { key: 'home',      label: 'Inicio',      icon: 'home-outline',        iconActive: 'home' },
  { key: 'movements', label: 'Movimientos', icon: 'list-outline',        iconActive: 'list' },
  { key: 'stats',     label: 'Stats',       icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'profile',   label: 'Perfil',      icon: 'person-outline',      iconActive: 'person' },
];

// ── Mock: semana con actividad (lunes a hoy=viernes) ──
const WEEK_SERIES: FlowSeriesPoint[] = [
  { date: '2026-06-08', label: 'L', income: 65000,  expense: 12000, isToday: false },
  { date: '2026-06-09', label: 'M', income: 142000, expense: 0,     isToday: false },
  { date: '2026-06-10', label: 'X', income: 38000,  expense: 95000, isToday: false },
  { date: '2026-06-11', label: 'J', income: 0,      expense: 8000,  isToday: false },
  { date: '2026-06-12', label: 'V', income: 88500,  expense: 15000, isToday: true },
];

// ── Mock: mes con 12 días transcurridos ──
const MONTH_SERIES: FlowSeriesPoint[] = Array.from({ length: 12 }, (_, i) => {
  const day = i + 1;
  const seeded = Math.abs(Math.sin(day * 7.3)); // pseudo-random estable
  return {
    date: `2026-06-${String(day).padStart(2, '0')}`,
    label: day === 1 || day % 5 === 0 ? String(day) : '',
    income: Math.round(seeded * 120000),
    expense: day % 4 === 0 ? Math.round(seeded * 60000) : 0,
    isToday: day === 12,
  };
});

const EMPTY_SERIES: FlowSeriesPoint[] = WEEK_SERIES.map(p => ({
  ...p,
  income: 0,
  expense: 0,
}));

// ── Mock: MonthFlowResult para FlowPairSection (D-9) ──
const MOCK_FLOW: MonthFlowResult = {
  income: {
    total: 492400, count: 4,
    byChannel: [
      { key: 'acc-mp', label: 'Mercado Pago', amount: 240000, percent: 48.7 },
      { key: 'acc-cash', label: 'Efectivo', amount: 194400, percent: 39.5 },
      { key: '__pending__', label: 'Pendiente cobro', amount: 58000, percent: 11.8 },
    ],
    byCategory: [
      { key: 'service', label: 'Venta de servicio', amount: 350000, percent: 71.1 },
      { key: 'product', label: 'Venta de producto', amount: 142400, percent: 28.9 },
    ],
    previousTotal: 438000, previousCount: 6,
  },
  expense: {
    total: 450000, count: 1,
    byChannel: [
      { key: 'acc-bank', label: 'Banco', amount: 450000, percent: 100 },
    ],
    byCategory: [
      { key: 'rent', label: 'Alquiler', amount: 450000, percent: 100 },
    ],
    previousTotal: 480000, previousCount: 2,
  },
  prevLabel: 'Mayo 2026',
  series: MONTH_SERIES,
  prevDailyAvgIncome: 45000,
};

export default function DesignPreviewScreen() {
  const [incomeAxis, setIncomeAxis] = useState<BreakdownAxis>('channel');
  const [expenseAxis, setExpenseAxis] = useState<BreakdownAxis>('channel');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('home');
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Heading level={1}>DS Preview</Heading>
        <Text variant="caption" color="tertiary">
          Galería de primitivos con datos mock. No toca Supabase.
        </Text>

        <Section title="PeriodBars — semana (hoy enfatizado + prom)">
          <Card padding="lg">
            <PeriodBars
              points={WEEK_SERIES.map(p => ({
                key: p.date, label: p.label, up: p.income,
                down: p.expense, emphasized: p.isToday,
              }))}
              avgLine={71000}
              avgLabel="prom"
            />
          </Card>
        </Section>

        <Section title="PeriodBars — mes (barras finas, eje espaciado)">
          <Card padding="lg">
            <PeriodBars
              points={MONTH_SERIES.map(p => ({
                key: p.date, label: p.label, up: p.income,
                down: p.expense, emphasized: p.isToday,
              }))}
              avgLine={45000}
            />
          </Card>
        </Section>

        <Section title="PeriodBars — sin movimientos">
          <Card padding="lg">
            <PeriodBars
              points={EMPTY_SERIES.map(p => ({
                key: p.date, label: p.label, up: p.income,
                down: p.expense, emphasized: p.isToday,
              }))}
              avgLine={0}
            />
          </Card>
        </Section>

        <Section title="PeriodBalanceCard — integrada (héroe del período)">
          <PeriodBalanceCard
            income={333500}
            expense={130000}
            period="week"
            series={WEEK_SERIES}
            prevDailyAvgIncome={71000}
            prevIncome={297000}
            prevExpense={140000}
            prevLabel="semana pasada"
          />
        </Section>

        <Section title="TabBar — navegación inferior (D-4, Ionicons)">
          <TabBar items={PREVIEW_TABS} active={previewTab} onChange={setPreviewTab} />
        </Section>

        <Section title="SideNav — navegación escritorio (D-15 paso 2)">
          <View style={{ height: 320, flexDirection: 'row' }}>
            <SideNav items={PREVIEW_TABS} active={previewTab} onChange={setPreviewTab} />
          </View>
        </Section>

        <Section title="FlowPairSection — par Ingresos/Costos (D-9)">
          <FlowPairSection
            flow={MOCK_FLOW}
            period="month"
            incomeAxis={incomeAxis}
            expenseAxis={expenseAxis}
            onIncomeAxisChange={setIncomeAxis}
            onExpenseAxisChange={setExpenseAxis}
            onLinePress={(kind, key, label) =>
              console.log('[preview] linePress', kind, key, label)
            }
          />
        </Section>

        <Section title="PeriodBalanceCard — balance negativo">
          <PeriodBalanceCard
            income={130000}
            expense={333500}
            period="week"
            series={WEEK_SERIES.map(p => ({
              ...p, income: p.expense, expense: p.income,
            }))}
            prevDailyAvgIncome={30000}
            prevIncome={140000}
            prevExpense={297000}
            prevLabel="semana pasada"
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space['6'] }}>
      <Text variant="micro" color="secondary" uppercase style={{ marginBottom: space['2'] }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },
  scroll: { padding: space['5'], paddingTop: space['12'], paddingBottom: space['16'], maxWidth: 560, width: '100%', alignSelf: 'center' },
});
