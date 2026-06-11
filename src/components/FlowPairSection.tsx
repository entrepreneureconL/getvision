/**
 * <FlowPairSection /> — Ingresos + Costos lado a lado (D-9, GETVISION_DESIGN).
 *
 * Pedido CEO 2026-06-10: "ampliar el uso del tamaño de pantalla con los datos,
 * no solo eje vertical". Reemplaza los dos MonthFlowCard apilados del Dashboard
 * simple por:
 *
 *   ┌─ Ingresos ──┐ ┌─ Costos ───┐   ← dos tiles compactos en FILA
 *   │ $ 492.400   │ │ $ 450.000  │     (tap → selecciona/expande)
 *   │ ↑ +12%      │ │ ↓ −5%      │
 *   └─────────────┘ └────────────┘
 *   ┌─ detalle del seleccionado (ancho completo) ──┐
 *   │ [Canal | Etiqueta]                            │
 *   │ ▸ Mercado Pago    $ 198.500                   │  ← tap → historial
 *   │ ▸ Efectivo        $  85.300                   │     filtrado (F1-M.4)
 *   └───────────────────────────────────────────────┘
 *
 * El detalle expande a ancho COMPLETO debajo del par (no dentro del tile de
 * 50% — las líneas de composición necesitan aire). Un solo detalle abierto a
 * la vez: menos estado visual, lectura enfocada.
 *
 * Reglas heredadas de MonthFlowCard (que queda para reuso futuro en Stats):
 *   §5.4.3 — Costos gris neutro; rojo solo si el balance del período < 0.
 *   §5.2.7 — Tap en línea → historial filtrado vía onLinePress.
 *   Delta semántico: ingresos subir=verde; costos subir=rojo.
 */

import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import type { MonthFlowResult, FlowLine } from '../repos/analytics';
import { PENDING_KEY, UNLABELED_KEY } from '../utils/historyFilters';
import type { BreakdownAxis } from '../schemas/business';
import type { Period } from '../utils/periods';
import Money from './Money';
import {
  Text,
  Stack,
  Card,
  Divider,
  SegmentedControl,
  color,
  space,
  text as tokenText,
} from '../design';

type FlowKind = 'income' | 'expense';

type Props = {
  flow: MonthFlowResult;
  period: Period;
  incomeAxis: BreakdownAxis;
  expenseAxis: BreakdownAxis;
  onIncomeAxisChange: (next: BreakdownAxis) => void;
  onExpenseAxisChange: (next: BreakdownAxis) => void;
  /** Tap en línea de composición → historial filtrado (F1-M.4). */
  onLinePress: (kind: FlowKind, key: string, label: string) => void;
};

const PERIOD_NOUN: Record<Period, string> = {
  day:   'del día',
  week:  'de la semana',
  month: 'del mes',
  year:  'del año',
};

const KIND_COPY: Record<FlowKind, { title: string; singular: string; plural: string }> = {
  income:  { title: 'Ingresos', singular: 'venta',      plural: 'ventas' },
  expense: { title: 'Costos',   singular: 'movimiento', plural: 'movimientos' },
};

export default function FlowPairSection({
  flow,
  period,
  incomeAxis,
  expenseAxis,
  onIncomeAxisChange,
  onExpenseAxisChange,
  onLinePress,
}: Props) {
  const [expanded, setExpanded] = useState<FlowKind | null>(null);

  const balanceNegative = flow.income.total - flow.expense.total < 0;

  const toggle = (kind: FlowKind) =>
    setExpanded(prev => (prev === kind ? null : kind));

  const detailBlock = expanded === 'income' ? flow.income : flow.expense;
  const detailAxis = expanded === 'income' ? incomeAxis : expenseAxis;
  const onDetailAxisChange =
    expanded === 'income' ? onIncomeAxisChange : onExpenseAxisChange;
  const detailLines =
    detailAxis === 'channel' ? detailBlock.byChannel : detailBlock.byCategory;

  return (
    <View>
      {/* ── Par de tiles ── */}
      <Stack direction="row" gap="3">
        <FlowTile
          kind="income"
          block={flow.income}
          period={period}
          prevLabel={flow.prevLabel}
          tone="neutral"
          selected={expanded === 'income'}
          onPress={() => toggle('income')}
        />
        <FlowTile
          kind="expense"
          block={flow.expense}
          period={period}
          prevLabel={flow.prevLabel}
          tone={balanceNegative ? 'danger' : 'neutral'}
          selected={expanded === 'expense'}
          onPress={() => toggle('expense')}
        />
      </Stack>

      {/* ── Detalle compartido, ancho completo ── */}
      {expanded ? (
        <View style={{ marginTop: space['3'] }}>
          <Card variant="elevated" padding="md">
            <Stack direction="row" justify="space-between" align="center">
              <Text variant="micro" color="secondary" uppercase>
                {KIND_COPY[expanded].title} {PERIOD_NOUN[period]} — detalle
              </Text>
              <TouchableOpacity
                onPress={() => setExpanded(null)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text variant="caption" color="tertiary">Cerrar ✕</Text>
              </TouchableOpacity>
            </Stack>

            <View style={{ marginTop: space['3'] }}>
              <SegmentedControl<BreakdownAxis>
                size="sm"
                value={detailAxis}
                onChange={onDetailAxisChange}
                options={[
                  { value: 'channel',  label: 'Canal' },
                  { value: 'category', label: 'Etiqueta' },
                ]}
              />
            </View>

            <Divider variant="subtle" spacing="3" />

            {detailLines.length > 0 ? (
              <Stack gap="2">
                {detailLines.map(line => (
                  <CompositionLine
                    key={line.key}
                    line={line}
                    onPress={() => onLinePress(expanded, line.key, line.label)}
                  />
                ))}
              </Stack>
            ) : (
              <Text variant="caption" color="tertiary" align="center">
                Sin {expanded === 'income' ? 'ingresos' : 'costos'} este período.
              </Text>
            )}

            <Text
              variant="micro"
              color="tertiary"
              align="center"
              style={{ marginTop: space['3'] }}
            >
              Tocá una línea para ver esos movimientos
            </Text>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Tile compacto — mitad del ancho. Total + contador + delta.
// ────────────────────────────────────────────────────────────────────

type TileProps = {
  kind: FlowKind;
  block: MonthFlowResult['income'];
  period: Period;
  prevLabel: string;
  tone: 'neutral' | 'danger';
  selected: boolean;
  onPress: () => void;
};

function FlowTile({ kind, block, period, prevLabel, tone, selected, onPress }: TileProps) {
  const copy = KIND_COPY[kind];
  const { total, count, previousTotal } = block;

  // Delta semántico: ingresos subir=bueno; costos subir=malo.
  const deltaAmount = total - previousTotal;
  const deltaPercent = previousTotal !== 0
    ? (deltaAmount / Math.abs(previousTotal)) * 100
    : null;
  const showDelta = (total > 0 || previousTotal > 0) && deltaAmount !== 0;
  const isUp = deltaAmount > 0;
  const deltaColor =
    kind === 'income'
      ? (isUp ? color.success.base : color.danger.base)
      : (isUp ? color.danger.base : color.success.base);
  const arrow = isUp ? '↑' : '↓';

  const totalColor = tone === 'danger' ? color.danger.base : color.text.primary;

  const totalStyle = {
    fontSize: tokenText.size['2xl'],
    lineHeight: tokenText.lineHeight['2xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tight,
    color: totalColor,
  };

  return (
    <Card
      variant={selected ? 'elevated' : 'surface'}
      padding="md"
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Text variant="micro" color="secondary" uppercase numberOfLines={1}>
        {copy.title} {PERIOD_NOUN[period]}
      </Text>

      <View style={{ marginTop: space['2'] }}>
        <Money amount={total} prefix="$ " style={totalStyle} mutedDecimals />
      </View>

      {count > 0 ? (
        <Text variant="micro" color="tertiary" style={{ marginTop: space['1'] }}>
          {count} {count === 1 ? copy.singular : copy.plural}
        </Text>
      ) : null}

      {showDelta && deltaPercent !== null ? (
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: deltaColor, marginTop: space['1'] }}
        >
          {arrow} {deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(0)}% vs {prevLabel}
        </Text>
      ) : null}

      <Text
        variant="micro"
        color={selected ? 'accent' : 'tertiary'}
        style={{ marginTop: space['2'] }}
      >
        {selected ? 'Ocultar ▴' : 'Ver detalle ▾'}
      </Text>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Línea de composición — heredada de MonthFlowCard (mismas reglas de color).
// ────────────────────────────────────────────────────────────────────

function CompositionLine({ line, onPress }: { line: FlowLine; onPress: () => void }) {
  const isPending = line.key === PENDING_KEY;
  const isUnlabeled = line.key === UNLABELED_KEY;

  let amountColor: string = color.text.primary;
  if (isPending) amountColor = color.warning.base;
  else if (isUnlabeled) amountColor = color.text.secondary;

  const labelColorVariant: 'secondary' | 'tertiary' =
    isPending || isUnlabeled ? 'tertiary' : 'secondary';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="caption" color={labelColorVariant} numberOfLines={1} style={{ flex: 1 }}>
          ▸  {line.label}
        </Text>
        <Stack direction="row" align="center" gap="2">
          <Money
            amount={line.amount}
            prefix="$ "
            style={{
              fontSize: tokenText.size.sm,
              lineHeight: tokenText.lineHeight.sm,
              fontWeight: tokenText.weight.medium as '500',
              color: amountColor,
            }}
          />
          {isPending ? (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: color.warning.base,
              }}
            />
          ) : null}
        </Stack>
      </Stack>
    </TouchableOpacity>
  );
}
