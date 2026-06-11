/**
 * <MiPlataCard /> — variación neta de la plata por cuenta (F1-M Fase B · B5).
 *
 * Tras refactor B5 (feedback CEO 2026-06-09) este card cambió de STOCK a FLOW
 * NETO POR CUENTA del período elegido. Análogo conceptual al bloque Ingresos/
 * Costos del mes, pero desglosado por cuenta y neto (entradas − salidas).
 *
 * Lo que muestra cada chip:
 *   Hoy    → cuánto se movió tu plata HOY (+ pendientes proyectados a futuro)
 *   Semana → variación neta de esta semana (lunes a hoy)
 *   Mes    → variación neta de este mes (día 1 a hoy)
 *   Año    → variación neta de este año (1 ene a hoy)
 *
 * Reglas heredadas (§13 MASTER · honestidad numérica):
 *   - Variación > 0  → verde (positivo, te subió)
 *   - Variación < 0  → rojo  (negativo, te bajó)
 *   - Variación == 0 → gris  (sin movimientos)
 *
 * Pendientes (Por cobrar / Por pagar) + Neto proyectado + hint "Tap para ver
 * pendientes" SOLO aparecen en chip 'today' — para los otros chips son
 * proyecciones STOCK futuras que no encajan con FLOW histórico.
 *
 * `currentLiquidNow` viaja como caption al pie ("Saldo total: $X") para que
 * el usuario no pierda de vista cuánto tiene en total — info de referencia.
 *
 * Props de extensión:
 *   - onPendingPress  → atajo a MovementForm tab Pendientes. Heredado de F1-K.3.
 *   - onChannelPress  → F1-M.4: tap en línea de cuenta → historial filtrado.
 *
 * G-1 (GETVISION_DESIGN, 2026-06-10): el SegmentedControl interno se eliminó.
 * El período ahora lo gobierna el selector ÚNICO del Dashboard — dos relojes
 * en la misma pantalla eran fricción cognitiva directa. "Año" migra a la
 * futura tab Stats (no existe en el selector unificado Hoy/Semana/Mes).
 */

import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AccountVariation, MiPlataSnapshot } from '../repos/analytics';
import type { StockPeriod } from '../utils/periods';
import { formatMoney, splitMoneyParts } from './Money';
import {
  Text,
  Stack,
  Card,
  Divider,
  color,
  space,
  text as tokenText,
} from '../design';

type Props = {
  /** Snapshot con variation, variationByAccount y delta (F1-M Fase B · B5). */
  snapshot: MiPlataSnapshot;
  /** Tap sobre la card cuando hay pendientes → MovementForm tab Pendientes. */
  onPendingPress?: () => void;
  /** F1-M.4 — tap en línea de cuenta → historial filtrado por cuenta. */
  onChannelPress?: (account: AccountVariation) => void;
};

const PERIOD_NOUN: Record<StockPeriod, string> = {
  today: 'hoy',
  week:  'esta semana',
  month: 'este mes',
  year:  'este año',
};

export default function MiPlataCard({
  snapshot,
  onPendingPress,
  onChannelPress,
}: Props) {
  const {
    variation,
    variationByAccount,
    receivablesPending,
    payablesPending,
    pendingCount,
    currentLiquidNow,
    delta,
    period,
    prevLabel,
  } = snapshot;

  const hasReceivables = receivablesPending > 0;
  const hasPayables = payablesPending > 0;
  const hasAnyPending = hasReceivables || hasPayables;

  // Pendientes: SIEMPRE visibles si existen (feedback CEO 2026-06-11 — el dato
  // se perdía al cambiar de período). Son stock del presente, no del período.
  const showPendingBlock = hasAnyPending;
  // El Neto proyectado mezcla variación del período con stock futuro — solo
  // tiene lectura limpia en 'Hoy' (variación de hoy + lo que entra/sale).
  const showNetProjected = period === 'today' && hasAnyPending;

  // Filtramos cuentas sin variación en el período. Una cuenta con $0 movido
  // no aporta a la lectura ("Banco: $0" no dice nada útil).
  const visibleAccounts = variationByAccount.filter(
    a => Math.abs(a.variation) > 0.005,
  );

  // Neto proyectado solo cuando hay pendientes (incluye variación hoy + a cobrar
  // − a pagar). No es lo mismo que la variación pura — es el escenario "si todo
  // se cumple". Mismo concepto que en F1-J.5 pero aplicado a chip 'today'.
  const netProjected = variation + receivablesPending - payablesPending;

  // Sin esconder negativo (§13 MASTER · honestidad numérica).
  let variationColor: string = color.text.tertiary;
  if (variation > 0) variationColor = color.success.base;
  else if (variation < 0) variationColor = color.danger.base;

  const netColor =
    netProjected < 0 ? color.danger.base : color.text.primary;

  // Hero number — 5xl bold con sign explícito.
  const displayStyle = {
    fontSize: tokenText.size['5xl'],
    lineHeight: tokenText.lineHeight['5xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tighter,
    color: variationColor,
  };

  const netValueStyle = {
    fontSize: tokenText.size.md,
    lineHeight: tokenText.lineHeight.md,
    fontWeight: tokenText.weight.semibold as '600',
    color: netColor,
  };

  // Card tappable SOLO cuando hay pendientes visibles (chip 'today' + pendientes).
  // El chevron interior gana al parent en RN, no hay conflicto.
  const cardOnPress = showPendingBlock ? onPendingPress : undefined;

  // Composición colapsada por default (D1).
  const [expanded, setExpanded] = useState(false);

  // Comparativa delta vs período anterior.
  let deltaColor: string = color.text.tertiary;
  if (delta.amount > 0) deltaColor = color.success.base;
  else if (delta.amount < 0) deltaColor = color.danger.base;
  const arrow = delta.amount > 0 ? '↑' : delta.amount < 0 ? '↓' : '·';
  // Para 'today' con delta=0 (sin movimientos hoy ni ayer) ocultamos la línea.
  const showDelta = delta.amount !== 0;

  return (
    <Card variant="surface" padding="lg" onPress={cardOnPress}>
      {/* ── Encabezado con chevron de expand ── */}
      <Stack direction="row" justify="space-between" align="center">
        {/* D-3: Ionicons en lugar de emoji (paridad visual cross-platform). */}
        <Stack direction="row" align="center" gap="2">
          <Ionicons name="wallet-outline" size={14} color={color.text.secondary} />
          <Text variant="micro" color="secondary" uppercase>
            Mi plata · {PERIOD_NOUN[period]}
          </Text>
        </Stack>
        {visibleAccounts.length > 0 ? (
          <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="caption" color="tertiary">
              {expanded ? 'Ocultar ▴' : 'Ver cuentas ▾'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Stack>

      {/* ── Variación neta del período (hero number) ──
          G-6: decimales atenuados por tamaño + opacidad, MISMO color que el
          entero (feedback CEO 2026-06-11 — un dato, un matiz). */}
      <View style={{ marginTop: space['3'] }}>
        <Text style={displayStyle}>
          {variation > 0 ? '+ ' : variation < 0 ? '− ' : ''}
          $ {splitMoneyParts(variation).int}
          <Text
            style={{
              fontSize: Math.round(tokenText.size['5xl'] * 0.5),
              opacity: 0.55,
              fontWeight: tokenText.weight.medium as '500',
            }}
          >
            ,{splitMoneyParts(variation).dec}
          </Text>
        </Text>
      </View>

      {/* ── Comparativa "vs período anterior" ── */}
      {showDelta ? (
        <Text
          variant="caption"
          style={{ color: deltaColor, marginTop: space['1'] }}
        >
          {arrow} {delta.amount >= 0 ? '+' : '−'}$ {formatMoney(delta.amount)}
          {delta.percent !== null
            ? ` (${delta.percent >= 0 ? '+' : ''}${delta.percent.toFixed(1)}%)`
            : ''}
          {'  '}vs {prevLabel}
        </Text>
      ) : null}

      {/* ── Composición por cuenta — colapsada por default ── */}
      {visibleAccounts.length > 0 && expanded ? (
        <>
          <Divider variant="subtle" spacing="3" />
          <Stack gap="2">
            {visibleAccounts.map(a => (
              <VariationRow
                key={a.id}
                account={a}
                onPress={onChannelPress ? () => onChannelPress(a) : undefined}
              />
            ))}
          </Stack>
        </>
      ) : null}

      {/* ── Pendientes + Neto proyectado (solo chip 'today') ── */}
      {showPendingBlock ? (
        <>
          <View style={{ marginTop: space['3'] }}>
            <Stack gap="2">
              {hasReceivables ? (
                <PendingRow
                  label="Por cobrar"
                  count={pendingCount.receivables}
                  amount={receivablesPending}
                  sign="+"
                  tone="success"
                />
              ) : null}
              {hasPayables ? (
                <PendingRow
                  label="Por pagar"
                  count={pendingCount.payables}
                  amount={payablesPending}
                  sign="−"
                  tone="danger"
                />
              ) : null}
            </Stack>
          </View>

          {showNetProjected ? (
            <>
              <Divider variant="subtle" spacing="3" />
              <Stack direction="row" justify="space-between" align="center">
                <Text variant="captionStrong" color="secondary">
                  Neto proyectado
                </Text>
                <Text style={netValueStyle}>$ {formatMoney(netProjected)}</Text>
              </Stack>
            </>
          ) : null}

          {onPendingPress ? (
            <Text
              variant="caption"
              color="tertiary"
              align="center"
              style={{ marginTop: space['3'] }}
            >
              Tocá para ver pendientes
            </Text>
          ) : null}
        </>
      ) : null}

      {/* ── Sub-info de referencia: saldo TOTAL ahora (stock) ── */}
      <Divider variant="subtle" spacing="3" />
      <Text variant="caption" color="tertiary" align="center">
        Saldo total ahora · $ {formatMoney(currentLiquidNow)}
      </Text>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-componentes locales — chicos, no se reusan fuera de acá.
// ────────────────────────────────────────────────────────────────────

type VariationRowProps = {
  account: AccountVariation;
  onPress?: () => void;
};

/** Línea de variación por cuenta: "▸ Mercado Pago   + $ 240.000". */
function VariationRow({ account, onPress }: VariationRowProps) {
  const { name, variation } = account;
  const isPositive = variation > 0;
  const isNegative = variation < 0;

  let amountColor: string = color.text.primary;
  if (isPositive) amountColor = color.success.base;
  else if (isNegative) amountColor = color.danger.base;

  const sign = isPositive ? '+ ' : isNegative ? '− ' : '';

  const row = (
    <Stack direction="row" justify="space-between" align="center">
      <Text variant="caption" color="secondary">
        ▸  {name}
      </Text>
      <Text
        variant="caption"
        style={{
          color: amountColor,
          fontWeight: tokenText.weight.medium as '500',
        }}
      >
        {sign}$ {formatMoney(variation)}
      </Text>
    </Stack>
  );

  if (!onPress) return row;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {row}
    </TouchableOpacity>
  );
}

type PendingRowProps = {
  label: string;
  count: number;
  amount: number;
  sign: '+' | '−';
  tone: 'success' | 'danger';
};

/** Línea de pendientes: "▸ Por cobrar   +$ 58.000  ●". */
function PendingRow({ label, count, amount, sign, tone }: PendingRowProps) {
  const toneColor = tone === 'success' ? color.success.base : color.danger.base;
  const displayLabel = count > 1 ? `${label} (${count})` : label;

  return (
    <Stack direction="row" justify="space-between" align="center">
      <Text variant="caption" color="secondary">
        ▸  {displayLabel}
      </Text>
      <Stack direction="row" align="center" gap="2">
        <Text
          variant="caption"
          style={{
            color: toneColor,
            fontWeight: tokenText.weight.medium as '500',
          }}
        >
          {sign}$ {formatMoney(amount)}
        </Text>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: toneColor,
          }}
        />
      </Stack>
    </Stack>
  );
}
