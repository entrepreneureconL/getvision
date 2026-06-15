/**
 * <CalendarMonthExpanded /> — vista expandida del calendario (primitivo #17, D-23.b1).
 *
 * El "widget → ampliar" estilo iOS/macOS: al expandir, el calendario ocupa el
 * ancho de las dos columnas del escritorio y muestra MÁS densidad que el
 * compacto `<CalendarMonth/>` — montos por día en vez de puntos, una columna de
 * NETO por semana ("el mes laboral"), y un pie con totales del mes. Sigue siendo
 * el filtro del dashboard (la selección la gobierna el padre, igual que el
 * compacto). Spec + decisiones de color: GETVISION_DESIGN §4.9.b (gate CEO).
 *
 * Decisiones de color (gate CEO 2026-06-13) — en el pantallazo rápido NO puede
 * haber tres verdes que se confundan:
 *   - Ingresos = emerald, RESALTADOS (peso 500). Costos = rose.
 *   - Pedidos futuros = VIOLETA (`info`), vencidos = ÁMBAR (`warning`).
 *   - Selección de fechas/semana = SLATE (`selection`), no verde.
 *   - Neto = verde si +, rojo si − (por signo, como pidió el CEO).
 *
 * 100% View/Pressable + Ionicons, CERO deps (ADR #12). Montos compactos vía
 * `formatCompactMoney`. Fechas vía periods.ts (LESSONS #2). El neto semanal y
 * los totales del mes se DERIVAN de `days` (cero query extra): cuentan solo
 * días pasados (ADR #20 — el futuro no tiene plata).
 *
 * Clic en la celda semanal → `onWeekPress(weekStart, weekEnd)`: selecciona esa
 * semana como rango del dashboard (pedido CEO 2026-06-13).
 */

import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space } from '../tokens';
import { parseLocalISODate, toLocalISODate, todayLocalISO } from '../../utils/periods';
import { formatCompactMoney, formatFullMoney } from '../../utils/formatCompactMoney';
import type { CalendarDayData } from './CalendarMonth';
import DSText from './Text';

type Props = {
  /** Cualquier fecha del mes a renderizar ('YYYY-MM-DD'). */
  anchor: string;
  /** Datos agregados del mes. */
  days: CalendarDayData[];
  /** 'YYYY-MM-DD' de hoy. Inyectable para tests/mocks. */
  today?: string;
  /** Selección activa (día/rango). null = sin selección. */
  selection?: { start: string; end: string } | null;
  /** Tap en un día. */
  onDayPress?: (date: string) => void;
  /** Tap en la celda de NETO semanal → seleccionar esa semana como rango. */
  onWeekPress?: (weekStart: string, weekEnd: string) => void;
  /** Navegación de mes (chevrons). */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Volver al mes actual. El padre lo pasa solo si el ancla ≠ mes de hoy. */
  onToday?: () => void;
  /** Contraer a la vista compacta. */
  onContract?: () => void;
  /** Pie: comparación vs período anterior, p.ej. label="mayo" pct={18}. Opcional. */
  comparisonLabel?: string;
  comparisonPct?: number;
};

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DISC = 22;

function monthYearLabel(d: Date): string {
  const raw = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function CalendarMonthExpanded({
  anchor,
  days,
  today = todayLocalISO(),
  selection = null,
  onDayPress,
  onWeekPress,
  onPrevMonth,
  onNextMonth,
  onToday,
  onContract,
  comparisonLabel,
  comparisonPct,
}: Props) {
  const anchorDate = parseLocalISODate(anchor);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const dataByDate = new Map(days.map(d => [d.date, d]));

  // Grilla en semanas completas (filas de 7), con huecos a los costados.
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const isoOf = (day: number) => toLocalISODate(new Date(year, month, day));

  // Totales del mes (solo días pasados — ADR #20).
  let monthIncome = 0;
  let monthExpense = 0;
  for (const d of days) {
    if (d.date > today) continue;
    monthIncome += d.income;
    monthExpense += d.expense;
  }
  const monthNet = monthIncome - monthExpense;

  return (
    <View>
      {/* ── Header: ‹ Mes › … Hoy · contraer ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space['3'] }}>
        {onPrevMonth ? (
          <Pressable onPress={onPrevMonth} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={20} color={color.text.secondary} />
          </Pressable>
        ) : null}
        <DSText variant="bodyStrong" style={{ marginHorizontal: space['1'] }}>
          {monthYearLabel(anchorDate)}
        </DSText>
        {onNextMonth ? (
          <Pressable onPress={onNextMonth} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="chevron-forward" size={20} color={color.text.secondary} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {onToday ? (
          <Pressable
            onPress={onToday}
            hitSlop={8}
            style={{
              paddingHorizontal: space['2'],
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: color.accent.subtle,
              marginRight: space['2'],
            }}
          >
            <DSText variant="micro" color="accent">Hoy</DSText>
          </Pressable>
        ) : null}
        {onContract ? (
          <Pressable onPress={onContract} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="Contraer">
            <Ionicons name="contract-outline" size={18} color={color.text.secondary} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Fila de iniciales: L M X J V S D + "Semana" ── */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_INITIALS.map((ini, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <DSText variant="micro" color="tertiary">{ini}</DSText>
          </View>
        ))}
        <View style={{ flex: 1.15, alignItems: 'center' }}>
          <DSText variant="micro" color="tertiary">Semana</DSText>
        </View>
      </View>

      {/* ── Grilla: filas de semana ── */}
      {weeks.map((week, wi) => {
        const inMonth = week.filter((d): d is number => d != null);
        const weekStart = inMonth.length ? isoOf(inMonth[0]) : '';
        const weekEnd = inMonth.length ? isoOf(inMonth[inMonth.length - 1]) : '';

        // Neto semanal: solo días pasados de la fila. null = semana toda futura.
        let wIncome = 0;
        let wExpense = 0;
        let hasPast = false;
        for (const day of inMonth) {
          const iso = isoOf(day);
          if (iso > today) continue;
          hasPast = true;
          const d = dataByDate.get(iso);
          if (d) { wIncome += d.income; wExpense += d.expense; }
        }
        const weekNet = hasPast ? wIncome - wExpense : null;

        const weekSelected =
          selection != null && weekStart !== '' &&
          weekStart >= selection.start && weekEnd <= selection.end;

        return (
          <View key={wi} style={{ flexDirection: 'row', marginTop: 4 }}>
            {week.map((day, di) => (
              <DayCellExpanded
                key={di}
                day={day}
                iso={day != null ? isoOf(day) : ''}
                data={day != null ? dataByDate.get(isoOf(day)) : undefined}
                today={today}
                selection={selection}
                onDayPress={onDayPress}
              />
            ))}

            {/* Celda de neto semanal — tap selecciona la semana. */}
            <Pressable
              onPress={
                onWeekPress && weekStart !== '' ? () => onWeekPress(weekStart, weekEnd) : undefined
              }
              disabled={!onWeekPress || weekStart === ''}
              style={{
                flex: 1.15,
                minHeight: 72,
                marginLeft: 4,
                borderRadius: radius.md,
                backgroundColor: weekSelected ? color.selection.strong : color.bg.elevated,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <DSText variant="micro" color="tertiary" style={{ marginBottom: 2 }}>
                Sem {wi + 1}
              </DSText>
              {weekNet == null ? (
                <DSText variant="caption" style={{ color: color.text.disabled }}>—</DSText>
              ) : (
                <DSText
                  variant="captionStrong"
                  style={{ color: weekNet >= 0 ? color.success.base : color.danger.base }}
                >
                  {(weekNet >= 0 ? '+' : '−') + formatCompactMoney(weekNet)}
                </DSText>
              )}
            </Pressable>
          </View>
        );
      })}

      {/* ── Pie: leyenda + totales del mes ── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space['3'], marginTop: space['3'] }}>
        <LegendDot label="Ingresos" dotColor={color.success.base} />
        <LegendDot label="Costos" dotColor={color.danger.base} />
        <LegendDot label="Pedidos" dotColor={color.info.base} />
        <LegendDot label="Vencidos" dotColor={color.warning.base} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space['3'],
          marginTop: space['3'],
          paddingTop: space['3'],
          borderTopWidth: 1,
          borderTopColor: color.border.subtle,
        }}
      >
        {/* Issue 1 (2026-06-13): el PIE muestra el total real (full miles es-AR),
            no la magnitud k/M. La grilla (montos por día + columna semanal) sigue
            compacta — no se toca el ancho/peso en móvil. */}
        <DSText variant="micro" color="tertiary">Mes a la fecha</DSText>
        <DSText variant="caption" style={{ color: color.success.base }}>
          ↑ {formatFullMoney(monthIncome)}
        </DSText>
        <DSText variant="caption" style={{ color: color.danger.base }}>
          ↓ {formatFullMoney(monthExpense)}
        </DSText>
        <DSText variant="caption" color="secondary">
          Neto{' '}
          <DSText
            variant="captionStrong"
            style={{ color: monthNet >= 0 ? color.success.base : color.danger.base }}
          >
            {(monthNet >= 0 ? '+' : '−') + formatFullMoney(monthNet)}
          </DSText>
        </DSText>
        <View style={{ flex: 1 }} />
        {comparisonLabel != null && comparisonPct != null ? (
          <DSText
            variant="micro"
            style={{ color: comparisonPct >= 0 ? color.success.base : color.danger.base }}
          >
            {(comparisonPct >= 0 ? '+' : '') + comparisonPct}% vs {comparisonLabel}
          </DSText>
        ) : null}
      </View>
    </View>
  );
}

/** Una celda de día de la vista expandida: número + montos compactos + badge. */
function DayCellExpanded({
  day,
  iso,
  data,
  today,
  selection,
  onDayPress,
}: {
  day: number | null;
  iso: string;
  data?: CalendarDayData;
  today: string;
  selection: { start: string; end: string } | null;
  onDayPress?: (date: string) => void;
}) {
  if (day == null) {
    return <View style={{ flex: 1, minHeight: 72, marginRight: 4 }} />;
  }

  const isToday = iso === today;
  const isFuture = iso > today;
  const inRange = selection != null && iso >= selection.start && iso <= selection.end;

  const showIncome = !isFuture && (data?.income ?? 0) > 0;
  const showExpense = !isFuture && (data?.expense ?? 0) > 0;
  const hasOrders = (data?.ordersCount ?? 0) > 0;
  const showFutureOrders = (isFuture || isToday) && hasOrders;
  const showOverdueOrders = !isFuture && !isToday && hasOrders;

  const isInteractive = !!onDayPress && (!isFuture || hasOrders);

  const numColor = isToday
    ? color.text.inverse
    : isFuture
      ? color.text.disabled
      : color.text.primary;

  return (
    <Pressable
      onPress={onDayPress ? () => onDayPress(iso) : undefined}
      disabled={!isInteractive}
      style={{
        flex: 1,
        minHeight: 72,
        marginRight: 4,
        borderRadius: radius.md,
        padding: 6,
        backgroundColor: inRange ? color.selection.subtle : 'transparent',
      }}
    >
      {/* Número (hoy = disco teal). */}
      {isToday ? (
        <View
          style={{
            width: DISC,
            height: DISC,
            borderRadius: DISC / 2,
            backgroundColor: color.accent.base,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DSText variant="caption" style={{ color: numColor, fontWeight: '600' }}>{day}</DSText>
        </View>
      ) : (
        <DSText variant="caption" style={{ color: numColor }}>{day}</DSText>
      )}

      {/* Montos — ingresos RESALTADOS (peso 600). */}
      {showIncome ? (
        <DSText
          variant="micro"
          style={{ color: color.success.base, fontWeight: '600', marginTop: 4 }}
        >
          ↑ {formatCompactMoney(data!.income)}
        </DSText>
      ) : null}
      {showExpense ? (
        <DSText variant="micro" style={{ color: color.danger.base, marginTop: 2 }}>
          ↓ {formatCompactMoney(data!.expense)}
        </DSText>
      ) : null}

      {/* Badge de pedidos: violeta (futuro) / ámbar (vencido). */}
      {showFutureOrders || showOverdueOrders ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            paddingHorizontal: 5,
            height: 15,
            borderRadius: radius.pill,
            backgroundColor: showOverdueOrders ? color.warning.subtle : color.info.subtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DSText
            variant="micro"
            style={{
              lineHeight: 15,
              color: showOverdueOrders ? color.warning.base : color.info.base,
            }}
          >
            {data?.ordersCount} {showOverdueOrders ? 'venc.' : 'ped.'}
          </DSText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Punto de leyenda del pie. */
function LegendDot({ label, dotColor }: { label: string; dotColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      <DSText variant="micro" color="tertiary">{label}</DSText>
    </View>
  );
}
