/**
 * <PeriodBalanceCard /> — balance del período + gráfico de barras (D-2/G-3).
 *
 * Rediseño GETVISION_DESIGN (2026-06-10): de card de cierre subordinada a
 * HÉROE de la sección flow. La razón (gap G-3): el Balance es el dato que más
 * le importa al usuario ("¿gané o perdí?") y estaba último, al mismo peso
 * visual que Ingresos/Costos. Ahora abre la sección, con la respuesta en
 * grande y el gráfico <PeriodBars/> contando la historia día a día.
 *
 * Sigue siendo derivada — no consulta DB. Todo viene del MonthFlowResult que
 * el Dashboard ya cargó (cero costo extra).
 *
 * Reglas de color (MASTER §13 honestidad numérica):
 *   - balance > 0  → success / < 0 → danger / == 0 → text.secondary.
 *   - El delta vs período anterior usa la misma semántica (subir es bueno).
 *
 * El gráfico solo se muestra para week/month (≥ 2 puntos). Para 'day' el
 * <PeriodBars/> devuelve null solo — un día no es una serie.
 */

import { View } from 'react-native';
import type { Period } from '../utils/periods';
import type { FlowSeriesPoint } from '../repos/analytics';
import Money, { formatMoney } from './Money';
import {
  Text,
  Card,
  PeriodBars,
  color,
  space,
  text as tokenText,
} from '../design';

type Props = {
  income: number;
  expense: number;
  period: Period;
  /** D-2 — serie diaria del período (de MonthFlowResult.series). */
  series?: FlowSeriesPoint[];
  /** D-2 — promedio diario de ingresos del período anterior (línea "prom"). */
  prevDailyAvgIncome?: number;
  /** Totales del período anterior, para el delta del balance. */
  prevIncome?: number;
  prevExpense?: number;
  /** Label del período anterior ("ayer", "semana pasada", "Mayo 2026"). */
  prevLabel?: string;
};

const PERIOD_LABEL: Record<Period, string> = {
  day:   'Balance del día',
  week:  'Balance de la semana',
  month: 'Balance del mes',
  year:  'Balance del año',
};

export default function PeriodBalanceCard({
  income,
  expense,
  period,
  series,
  prevDailyAvgIncome = 0,
  prevIncome,
  prevExpense,
  prevLabel,
}: Props) {
  const balance = income - expense;

  let balanceColor: string = color.text.secondary;
  if (balance > 0) balanceColor = color.success.base;
  else if (balance < 0) balanceColor = color.danger.base;

  // 3xl: héroe de la sección flow, un escalón debajo del 5xl de MiPlata.
  // Jerarquía de pantalla: MiPlata (5xl) > Balance (3xl) > Ingresos/Costos (2xl).
  const displayStyle = {
    fontSize: tokenText.size['3xl'],
    lineHeight: tokenText.lineHeight['3xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tight,
    color: balanceColor,
  };

  const marginPct = income > 0 ? Math.round((balance / income) * 100) : null;

  // Delta del balance vs período anterior — misma semántica que MiPlata.
  const hasPrev = prevIncome != null && prevExpense != null && prevLabel != null;
  const prevBalance = hasPrev ? prevIncome! - prevExpense! : 0;
  const deltaAmount = balance - prevBalance;
  const showDelta = hasPrev && (balance !== 0 || prevBalance !== 0) && deltaAmount !== 0;
  let deltaColor: string = color.text.tertiary;
  if (deltaAmount > 0) deltaColor = color.success.base;
  else if (deltaAmount < 0) deltaColor = color.danger.base;
  const arrow = deltaAmount > 0 ? '↑' : '↓';

  const barPoints = (series ?? []).map(p => ({
    key: p.date,
    label: p.label,
    up: p.income,
    down: p.expense,
    emphasized: p.isToday,
  }));

  return (
    <Card variant="surface" padding="lg">
      <Text variant="micro" color="secondary" uppercase>
        {PERIOD_LABEL[period]}
      </Text>

      <View style={{ marginTop: space['2'] }}>
        <Money amount={balance} prefix="$ " style={displayStyle} mutedDecimals />
      </View>

      {marginPct !== null ? (
        <Text variant="caption" color="tertiary" style={{ marginTop: space['1'] }}>
          {marginPct >= 0 ? '+' : ''}{marginPct}% margen
        </Text>
      ) : null}

      {showDelta ? (
        <Text variant="caption" style={{ color: deltaColor, marginTop: space['1'] }}>
          {arrow} {deltaAmount >= 0 ? '+' : '−'}$ {formatMoney(deltaAmount)}
          {'  '}vs {prevLabel}
        </Text>
      ) : null}

      {/* ── Gráfico del período (D-2) — null solo si < 2 puntos ── */}
      {barPoints.length >= 2 ? (
        <>
          <View style={{ marginTop: space['4'] }}>
            <PeriodBars
              points={barPoints}
              avgLine={prevDailyAvgIncome}
              avgLabel="prom"
            />
          </View>

          {/* Leyenda mínima — 1 línea, sin competir con el dato. */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: space['2'],
              marginTop: space['3'],
            }}
          >
            <LegendDot tint={color.success.base} />
            <Text variant="micro" color="tertiary">Ingresos</Text>
            <LegendDot tint={color.danger.base} />
            <Text variant="micro" color="tertiary">Costos</Text>
            {prevDailyAvgIncome > 0 ? (
              <Text variant="micro" color="tertiary">
                ┄ prom. {prevLabel ?? 'período anterior'}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </Card>
  );
}

function LegendDot({ tint }: { tint: string }) {
  return (
    <View
      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }}
    />
  );
}
