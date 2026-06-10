/**
 * HistoryScreen — historial filtrado por canal o etiqueta (F1-M.4).
 *
 * Llega desde:
 *   • MiPlataCard tap en línea de canal → filter type='all', extracto de cuenta
 *   • MonthFlowCard income tap          → filter type='income', axis=incomeAxis
 *   • MonthFlowCard expense tap         → filter type='expense', axis=expenseAxis
 *
 * Comportamiento:
 *   - Header: ‹ Volver + título con label del filtro.
 *   - Sub-info: "X movimientos · total $Y" para que el usuario tenga el agregado
 *     del filtro sin contar a mano.
 *   - Selector de período: el filtro entra con un período inicial (heredado del
 *     dashboard) pero la pantalla deja al usuario expandirlo (Día/Semana/Mes).
 *   - Lista: TransactionList sin límite con los items del filtro.
 *
 * Nota sobre edit:
 *   No habilitamos `onItemPress` para editar desde acá — abrir el editor desde
 *   una pantalla 2 niveles profunda complica el back-nav y la app aún no
 *   soporta el patrón. Para editar, el usuario vuelve al dashboard.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
  Text as RNText,
  StyleSheet,
} from 'react-native';
import { transactionsRepo } from '../repos/transactions';
import { categoriesRepo } from '../repos/categories';
import { getPeriodRange, type Period } from '../utils/periods';
import type { HistoryFilter } from '../utils/historyFilters';
import type { Transaction } from '../schemas/transaction';
import type { CategoryOverride } from '../schemas/categoryOverride';
import { formatMoney } from '../components/Money';
import Container from '../components/Container';
import TransactionList from '../components/TransactionList';
import {
  Heading,
  Text,
  Stack,
  SegmentedControl,
  color,
  space,
  radius,
} from '../design';

type Props = {
  businessId: string;
  initialFilter: HistoryFilter;
  onBack: () => void;
};

const AXIS_LABEL: Record<HistoryFilter['axis'], string> = {
  channel: 'Canal',
  category: 'Etiqueta',
};

const TYPE_LABEL: Record<HistoryFilter['type'], string> = {
  income: 'Ingresos',
  expense: 'Costos',
  all: 'Movimientos',
};

export default function HistoryScreen({
  businessId,
  initialFilter,
  onBack,
}: Props) {
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<CategoryOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const range = getPeriodRange(filter.period);
    const [list, ovs] = await Promise.all([
      transactionsRepo.listForFilter(businessId, {
        type: filter.type,
        axis: filter.axis,
        key: filter.key,
        startDate: range.start,
        endDate: range.end,
      }),
      categoriesRepo.listForBusiness(businessId),
    ]);
    setTransactions(list);
    setOverrides(ovs);
    setLoading(false);
  }, [businessId, filter]);

  useEffect(() => { load(); }, [load]);

  const handlePeriodChange = (next: Period) => {
    setFilter(prev => ({ ...prev, period: next }));
  };

  // Sub-info: count + suma. Sum se calcula localmente (la lista ya viene
  // filtrada y suele ser corta — < 200 items en el escenario peor PyME).
  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const countLabel = transactions.length === 1 ? 'movimiento' : 'movimientos';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          {/* ── Header con back ── */}
          <Stack
            direction="row"
            align="center"
            gap="3"
            style={{ marginBottom: space['4'] }}
          >
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              style={styles.backHit}
            >
              <RNText style={styles.backChevron}>‹</RNText>
            </TouchableOpacity>
            <Stack gap="0" style={{ flex: 1 }}>
              <Text variant="micro" color="tertiary" uppercase>
                {TYPE_LABEL[filter.type]} · {AXIS_LABEL[filter.axis]}
              </Text>
              <Heading level={3} numberOfLines={1}>
                {filter.label}
              </Heading>
            </Stack>
          </Stack>

          {/* ── Resumen del filtro ── */}
          <View style={styles.summary}>
            <Text variant="caption" color="secondary">
              {transactions.length} {countLabel}
            </Text>
            <Text variant="bodyStrong">
              $ {formatMoney(totalAmount)}
            </Text>
          </View>

          {/* ── Selector de período ── */}
          <View style={{ marginTop: space['4'] }}>
            <SegmentedControl<Period>
              value={filter.period}
              onChange={handlePeriodChange}
              options={[
                { value: 'day', label: 'Día' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
              ]}
            />
          </View>

          {/* ── Lista ── */}
          <View style={{ marginTop: space['4'] }}>
            {loading ? (
              <Text variant="caption" color="tertiary" align="center">
                Cargando...
              </Text>
            ) : (
              <TransactionList
                transactions={transactions}
                emptyMessage="Sin movimientos para este filtro y período."
                categoryOverrides={overrides}
                // No habilitamos onItemPress — ver doc del componente arriba.
              />
            )}
          </View>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },
  scroll: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 80 },
  backHit: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.raised,
  },
  backChevron: { color: color.text.primary, fontSize: 22, marginTop: -2 },
  summary: {
    backgroundColor: color.bg.raised,
    borderRadius: radius.md,
    paddingVertical: space['3'],
    paddingHorizontal: space['4'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
