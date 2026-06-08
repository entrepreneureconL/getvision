/**
 * <HeroMetricCard /> — tarjeta destacada con la métrica hero del business.
 *
 * F1-D rediseño (iPhone Screen Time):
 *   - Sin border lateral del color de la métrica. La elevación viene del fondo
 *     `bg.raised` sobre `bg.base`, no de un borde. Más Apple-style.
 *   - Hero number en escala display (44px) — antes 32px.
 *   - Comparativa "↗ 12% vs período anterior" como elemento de primera clase
 *     (slot opcional, solo aparece cuando hay datos comparables).
 *   - Chip "Datos parciales" en lugar de la cápsula con borde gris.
 *   - Slot para mini chart reservado para F1-F (INDEC + agregación histórica).
 *
 * Estados que maneja:
 *   - Con datos: número + hint constructivo + comparativa opcional.
 *   - Parcial:   número + Chip "Datos parciales" + hint específico.
 *   - Vacío:     placeholder "—" + CTA explícito.
 */

import { View } from 'react-native';
import type { MetricResult } from '../repos/analytics';
import type { MetricComparison } from '../repos/analytics';
import Money, { formatMoney } from './Money';
import {
  Heading,
  Text,
  Stack,
  Card,
  Chip,
  color,
  space,
  text as tokenText,
} from '../design';

type Props = {
  metric: MetricResult;
  /** Acción opcional cuando el usuario tap. Futuro: abrir detalle/configuración. */
  onPress?: () => void;
  /** Hint extra que aparece arriba del número (caso típico: monthly_balance
   *  con mensaje según signo). */
  contextualNote?: string;
  /** Comparativa con período anterior. null = no hay datos comparables. */
  comparison?: MetricComparison | null;
  /** Etiqueta del período anterior ("semana pasada", "mes pasado") para el delta. */
  previousLabel?: string;
};

export default function HeroMetricCard({
  metric,
  onPress,
  contextualNote,
  comparison,
  previousLabel,
}: Props) {
  const { spec, value, isEmpty, isPartial, hint } = metric;

  return (
    <Card variant="surface" padding="lg" onPress={onPress}>
      {/* ── Encabezado: label + chip parcial ── */}
      <Stack direction="row" align="center" justify="space-between" gap="2">
        <Text variant="micro" color="secondary" uppercase>
          {spec.label}
        </Text>
        {isPartial && <Chip variant="warning" size="sm">Datos parciales</Chip>}
      </Stack>

      {/* ── Nota contextual opcional ── */}
      {contextualNote ? (
        <Text variant="caption" color="tertiary" style={{ marginTop: space['2'] }}>
          {contextualNote}
        </Text>
      ) : null}

      {/* ── Valor principal + comparativa ── */}
      <Stack direction="row" align="baseline" gap="3" style={{ marginTop: space['3'] }}>
        {isEmpty ? (
          <Heading level="display" color="tertiary">—</Heading>
        ) : (
          <ValueDisplay value={value} unit={spec.unit} />
        )}

        {!isEmpty && comparison && previousLabel ? (
          <ComparisonBadge delta={comparison.deltaPercent} prevLabel={previousLabel} />
        ) : null}
      </Stack>

      {/* ── Slot chart (F1-F) ── */}
      {/* Reservado: cuando lleguen agregados históricos + INDEC, el mini chart
          se renderea acá sin tocar nada más del componente. */}

      {/* ── Hint constructivo ── */}
      <Text
        variant="caption"
        color="secondary"
        style={{ marginTop: space['4'], lineHeight: 20 }}
      >
        {hint}
      </Text>
    </Card>
  );
}

/**
 * Renderiza el valor numérico con su formato propio según unit.
 *  - currency / currency_per_X → <Money> con prefijo "$ "
 *  - percent → número + "%"
 *  - number → solo número
 *
 * Tipografía display (44px) viene del Heading. El sufijo va más chico al lado.
 */
function ValueDisplay({ value, unit }: { value: number; unit: string }) {
  const displayStyle = {
    fontSize: tokenText.size['5xl'],
    lineHeight: tokenText.lineHeight['5xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tighter,
    color: color.text.primary,
  };
  const suffixStyle = {
    fontSize: tokenText.size.md,
    color: color.text.tertiary,
    fontWeight: tokenText.weight.medium as '500',
  };

  switch (unit) {
    case 'currency':
      return <Money amount={value} prefix="$ " style={displayStyle} />;
    case 'currency_per_day':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Money amount={value} prefix="$ " style={displayStyle} />
          <Text variant="body" color="tertiary" style={suffixStyle}>/día</Text>
        </View>
      );
    case 'currency_per_hour':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Money amount={value} prefix="$ " style={displayStyle} />
          <Text variant="body" color="tertiary" style={suffixStyle}>/hora</Text>
        </View>
      );
    case 'percent':
      return (
        <Heading level="display">
          {formatMoney(value).replace(',00', '')}%
        </Heading>
      );
    case 'number':
    default:
      return (
        <Heading level="display">
          {formatMoney(value).replace(',00', '')}
        </Heading>
      );
  }
}

/**
 * Badge "↗ 12% vs semana pasada" con color semántico.
 *
 * Por ahora: subir = verde, bajar = rojo. Sabemos que para cost_to_revenue_ratio
 * la semántica es inversa — eso lo manejamos cuando lleguemos a F1-A (toggle
 * de hero KPI). Deuda chica documentada.
 */
function ComparisonBadge({ delta, prevLabel }: { delta: number; prevLabel: string }) {
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.5;
  const variant: 'success' | 'danger' | 'neutral' = isFlat
    ? 'neutral'
    : isUp
    ? 'success'
    : 'danger';
  const arrow = isFlat ? '·' : isUp ? '↗' : '↘';
  const formatted = Math.abs(delta).toFixed(0);

  return (
    <Stack gap="0">
      <Chip variant={variant} size="sm">
        {arrow} {formatted}%
      </Chip>
      <Text variant="micro" color="tertiary" style={{ marginTop: space['1'] }}>
        vs {prevLabel.toLowerCase()}
      </Text>
    </Stack>
  );
}
