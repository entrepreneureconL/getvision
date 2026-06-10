/**
 * <MonthFlowCard /> — bloque FLOW del Dashboard simple (F1-M.2 / F1-M.3).
 *
 * Renderiza Ingresos del mes O Costos del mes con composición por canal o
 * por etiqueta — toggle controlado por el caller (que persiste la elección
 * en `businesses.income_breakdown_axis` / `.expense_breakdown_axis`).
 *
 * Wireframe §5.1 del Research:
 *   📈 INGRESOS DEL MES
 *      $ 342.800   (18 ventas)
 *      [Canal] [Etiqueta]   ← toggle
 *      ▸ Mercado Pago      $ 198.500
 *      ▸ Efectivo          $  85.300
 *      ▸ Transferencia     $  59.000
 *      ▸ Pendiente cobro   $  58.000   ●
 *
 * Reglas no-negociables:
 *   §5.2.5 — el período viene del SegmentedControl global; este componente NO
 *            lo elige (el caller le pasa data del rango correcto).
 *   §5.4.3 — Costos en gris neutro. Rojo solo cuando el balance global del
 *            mes < 0 → caller pasa `tone='danger'`. Default 'neutral'.
 *   §5.2.7 — Tap en una línea → atajo a historial filtrado. Caller conecta
 *            via `onLinePress(key, label)`. F1-M.4 lo cablea.
 *
 * Sobre el toggle: lo mantenemos visible siempre (incluso si el usuario solo
 * tiene 1 línea por etiqueta = "Sin etiqueta"). La info es útil — el usuario
 * aprende que no está taggeando.
 */

import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import type {
  FlowBlock,
  FlowLine,
} from '../repos/analytics';
import { PENDING_KEY, UNLABELED_KEY } from '../utils/historyFilters';
import type { BreakdownAxis } from '../schemas/business';
import Money, { formatMoney } from './Money';
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

type Variant = 'income' | 'expense';
type Tone = 'neutral' | 'danger';

type Props = {
  variant: Variant;
  data: FlowBlock;
  axis: BreakdownAxis;
  onAxisChange: (next: BreakdownAxis) => void;
  /** F1-M.4 — tap en una línea de composición → historial filtrado. */
  onLinePress?: (key: string, label: string) => void;
  /** Color del total. §5.4.3: 'danger' solo cuando el balance del mes < 0. */
  tone?: Tone;
  /** F1-M Fase B — label del período anterior ("ayer", "mes pasado", etc.). */
  prevLabel?: string;
};

const VARIANT_COPY: Record<Variant, {
  emoji: string;
  title: string;
  singular: string;
  plural: string;
  totalAccent: 'success' | 'neutral';
}> = {
  income:  { emoji: '📈', title: 'Ingresos del mes', singular: 'venta',      plural: 'ventas',      totalAccent: 'success' },
  expense: { emoji: '📉', title: 'Costos del mes',   singular: 'movimiento', plural: 'movimientos', totalAccent: 'neutral' },
};

export default function MonthFlowCard({
  variant,
  data,
  axis,
  onAxisChange,
  onLinePress,
  tone = 'neutral',
  prevLabel,
}: Props) {
  const { total, count, byChannel, byCategory, previousTotal } = data;
  const copy = VARIANT_COPY[variant];

  // F1-M Fase B — comparativa vs período anterior.
  // Semántica color: para ingresos, subir es bueno (success). Para costos, subir
  // es malo (danger). Esto es lo opuesto al MiPlata donde subir siempre es bueno.
  const deltaAmount = total - previousTotal;
  const deltaPercent = previousTotal !== 0
    ? (deltaAmount / Math.abs(previousTotal)) * 100
    : null;
  const showDelta = (total > 0 || previousTotal > 0) && prevLabel != null;
  const isUp = deltaAmount > 0;
  const isDown = deltaAmount < 0;
  const deltaColor =
    variant === 'income'
      ? (isUp ? color.success.base : isDown ? color.danger.base : color.text.tertiary)
      : (isUp ? color.danger.base  : isDown ? color.success.base : color.text.tertiary);
  const arrow = isUp ? '↑' : isDown ? '↓' : '·';

  const lines = axis === 'channel' ? byChannel : byCategory;

  // Color del total:
  //   - income siempre primary (no resaltamos verde; consistencia con HeroMetricCard).
  //   - expense: gris neutro por default, rojo solo si caller fuerza tone='danger'.
  const totalColor =
    tone === 'danger'
      ? color.danger.base
      : color.text.primary;

  // Tamaño 2xl (24px) — alineado con PeriodBalanceCard. La única card hero del
  // dashboard simple es MiPlata (5xl). Ingresos / Costos / Balance son resúmenes
  // del período, todos al mismo nivel jerárquico — leen como un trío visual.
  const displayStyle = {
    fontSize: tokenText.size['2xl'],
    lineHeight: tokenText.lineHeight['2xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tight,
    color: totalColor,
  };

  const countLabel = count === 1 ? copy.singular : copy.plural;

  // F1-M Fase A (D1) — composición colapsada por default. El usuario tap-toggle
  // el chevron del header para abrir/cerrar. Estado local; cada render del
  // dashboard vuelve al default cerrado (decisión de simplicidad — si en beta
  // los usuarios lo extrañan, persistimos en businesses).
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="surface" padding="lg">
      {/* ── Header con título + chevron de expand ── */}
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="micro" color="secondary" uppercase>
          {copy.emoji}  {copy.title}
        </Text>
        {total > 0 ? (
          <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="caption" color="tertiary">
              {expanded ? 'Ocultar ▴' : 'Ver detalle ▾'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Stack>

      {/* ── Total + contador ── */}
      <View style={{ marginTop: space['3'] }}>
        <Money amount={total} prefix="$ " style={displayStyle} />
      </View>
      {count > 0 ? (
        <Text variant="caption" color="tertiary" style={{ marginTop: space['1'] }}>
          {count} {countLabel}
        </Text>
      ) : null}

      {/* ── Comparativa vs período anterior (F1-M Fase B) ── */}
      {showDelta ? (
        <Text
          variant="caption"
          style={{ color: deltaColor, marginTop: space['1'] }}
        >
          {arrow} {deltaAmount >= 0 ? '+' : '−'}$ {formatMoney(deltaAmount)}
          {deltaPercent !== null
            ? ` (${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%)`
            : ''}
          {'  '}vs {prevLabel}
        </Text>
      ) : null}

      {/* ── Toggle Canal/Etiqueta + Composición — solo si expanded ── */}
      {total > 0 && expanded ? (
        <>
          <View style={{ marginTop: space['3'] }}>
            <SegmentedControl<BreakdownAxis>
              size="sm"
              value={axis}
              onChange={onAxisChange}
              options={[
                { value: 'channel',  label: 'Canal' },
                { value: 'category', label: 'Etiqueta' },
              ]}
            />
          </View>

          <Divider variant="subtle" spacing="3" />

          <Stack gap="2">
            {lines.map(line => (
              <CompositionLine
                key={line.key}
                line={line}
                tone={tone}
                onPress={onLinePress ? () => onLinePress(line.key, line.label) : undefined}
              />
            ))}
          </Stack>
        </>
      ) : null}

      {total === 0 ? (
        // Empty state — sin ingresos/costos en el período seleccionado.
        <Text
          variant="caption"
          color="tertiary"
          align="center"
          style={{ marginTop: space['4'] }}
        >
          Sin {variant === 'income' ? 'ingresos' : 'costos'} este período.
        </Text>
      ) : null}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Línea de composición — un row local. No se reusa fuera de acá.
// ────────────────────────────────────────────────────────────────────

type CompositionLineProps = {
  line: FlowLine;
  tone: Tone;
  onPress?: () => void;
};

function CompositionLine({ line, tone, onPress }: CompositionLineProps) {
  const isPending = line.key === PENDING_KEY;
  const isUnlabeled = line.key === UNLABELED_KEY;

  // Color del monto:
  //   - Pendiente → warning (orange) por ser dato "todavía no realizado".
  //   - Sin etiqueta → text.tertiary (apagado) — invita a taggear.
  //   - Default income → primary.
  //   - Default expense → primary; solo el TOTAL pinta rojo si tone='danger'.
  let amountColor: string = color.text.primary;
  if (isPending) amountColor = color.warning.base;
  else if (isUnlabeled) amountColor = color.text.secondary;
  else if (tone === 'danger') amountColor = color.danger.base;

  // Label color: pendientes y sin etiqueta van más apagados.
  const labelColorVariant: 'secondary' | 'tertiary' =
    isPending || isUnlabeled ? 'tertiary' : 'secondary';

  const row = (
    <Stack direction="row" justify="space-between" align="center">
      <Text variant="caption" color={labelColorVariant} numberOfLines={1}>
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
  );

  if (!onPress) return row;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {row}
    </TouchableOpacity>
  );
}
