/**
 * <CalendarMonth /> — calendario mensual del dashboard (primitivo #14 del DS).
 *
 * El widget de Calendario de iOS/macOS aplicado a plata: una grilla del mes
 * con marcas por día (puntos de ingreso/egreso) que además funciona como
 * filtro del período único del dashboard (selección de día o rango por tap-tap).
 *
 * Spec completa: GETVISION_DESIGN §4.7 (calendario filtro) + §4.7.bis (pedidos).
 *
 * Decisiones de diseño que el componente encarna:
 *   - NO es un segundo reloj: es la vista espacial del período único. La
 *     selección (día/rango) la gobierna el padre (sync bidireccional con el
 *     SegmentedControl se hace en la integración D-19.b, no acá).
 *   - Selección por tap-tap, NO drag (el drag en RN-web es frágil y pelea con
 *     el scroll en móvil — paridad LESSONS #1). El padre implementa la máquina
 *     de taps; este componente solo pinta la selección que recibe.
 *   - Honestidad numérica (ADR #20): los días FUTUROS no muestran puntos de
 *     PLATA (un ingreso en un día que no ocurrió miente). Sí pueden mostrar
 *     marca de PEDIDOS (compromiso de entrega, no plata) — visualmente distinta.
 *
 * Implementación 100% View + Pressable, CERO dependencias de calendario
 * (ni react-native-calendars ni similares — ADR #12, TECH §7). La grilla es
 * flexWrap de celdas con width 100/7%. Fechas SIEMPRE vía periods.ts
 * (toLocalISODate / parseLocalISODate) — LESSONS #2 timezone.
 *
 * Uso:
 *   <CalendarMonth
 *     anchor="2026-06-11"          // cualquier fecha del mes a renderizar
 *     today="2026-06-11"           // inyectable (tests / mocks); default hoy local
 *     days={getCalendarMonth(...)} // datos del mes (analyticsRepo)
 *     selection={{ start, end }}   // día único = start===end; rango = start<end
 *     onDayPress={d => ...}        // tap en un día (el padre arma la selección)
 *   />
 */

import { View, Pressable } from 'react-native';
import { color, radius, space } from '../tokens';
import { parseLocalISODate, toLocalISODate, todayLocalISO } from '../../utils/periods';
import DSText from './Text';

/**
 * Un día del mes con sus agregados. Estructuralmente compatible con
 * `CalendarDay` de analyticsRepo (la screen mapea repo → primitivo, igual que
 * FlowSeriesPoint → PeriodBarPoint en PeriodBars). El DS no importa de repos.
 */
export type CalendarDayData = {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Ingresos del día (>0 → punto emerald). Solo se pinta si el día ya ocurrió. */
  income: number;
  /** Egresos del día (>0 → punto rose). Solo se pinta si el día ya ocurrió. */
  expense: number;
  /** Pedidos con entrega ese día (>0 → marca de compromiso en hoy/futuro). */
  ordersCount: number;
};

type Props = {
  /** Cualquier fecha del mes a renderizar ('YYYY-MM-DD'). */
  anchor: string;
  /** Datos agregados del mes. Días sin entrada se renderizan sin marcas. */
  days: CalendarDayData[];
  /** 'YYYY-MM-DD' del día de hoy. Inyectable para tests/mocks. */
  today?: string;
  /** Selección activa. null = sin selección (estado "Mes"). */
  selection?: { start: string; end: string } | null;
  /** Tap en un día. Sin esto, las celdas no son interactivas. */
  onDayPress?: (date: string) => void;
};

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CELL_W = '14.2857%'; // 100 / 7
const DISC = 30; // diámetro del círculo del número (touch target cómodo con el padding)
const DOT = 5;

/** Mes con primera letra mayúscula: "junio 2026" → "Junio 2026". */
function monthYearLabel(d: Date): string {
  const raw = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function CalendarMonth({
  anchor,
  days,
  today = todayLocalISO(),
  selection = null,
  onDayPress,
}: Props) {
  const anchorDate = parseLocalISODate(anchor);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lunes-primero: getDay() devuelve 0=domingo..6=sábado → (n+6)%7 da 0=lunes.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  const dataByDate = new Map(days.map(d => [d.date, d]));

  return (
    <View>
      {/* Header — v1 SOLO mes actual, sin navegación (el pedido es estático). */}
      <DSText variant="bodyStrong" style={{ marginBottom: space['2'] }}>
        {monthYearLabel(anchorDate)}
      </DSText>

      {/* Fila de iniciales de día. */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_INITIALS.map((ini, i) => (
          <View key={i} style={{ width: CELL_W, alignItems: 'center' }}>
            <DSText variant="micro" color="tertiary">
              {ini}
            </DSText>
          </View>
        ))}
      </View>

      {/* Grilla del mes. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {/* Huecos hasta el día 1 para alinear la columna correcta. */}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={{ width: CELL_W }} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = toLocalISODate(new Date(year, month, day));
          const d = dataByDate.get(iso);

          const isToday = iso === today;
          const isFuture = iso > today;

          const inRange = selection != null && iso >= selection.start && iso <= selection.end;
          const isStart = selection != null && iso === selection.start;
          const isEnd = selection != null && iso === selection.end;
          const isEdge = isStart || isEnd;

          // Puntos de PLATA — solo si el día ya ocurrió (ADR #20).
          const showIncomeDot = !isFuture && (d?.income ?? 0) > 0;
          const showExpenseDot = !isFuture && (d?.expense ?? 0) > 0;
          // Marca de PEDIDOS — hoy o futuro, distinta de los puntos de plata.
          const showOrders = (isFuture || isToday) && (d?.ordersCount ?? 0) > 0;

          // Color del número según estado.
          const numColor = isEdge
            ? color.text.inverse
            : isToday
              ? color.accent.base
              : isFuture
                ? color.text.disabled
                : color.text.primary;
          const numWeight = isEdge || isToday || inRange ? '600' : '400';

          // Fondo del disco del número.
          const discBg = isEdge
            ? color.accent.base
            : isToday
              ? color.accent.subtle
              : 'transparent';

          return (
            <Pressable
              key={iso}
              onPress={onDayPress ? () => onDayPress(iso) : undefined}
              disabled={!onDayPress}
              style={{ width: CELL_W, paddingVertical: 2 }}
            >
              {/* Banda de selección de rango (accent.subtle continuo; extremos
                  redondeados pill). El disco sólido se monta encima en los bordes. */}
              <View
                style={[
                  {
                    minHeight: 46,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 3,
                    backgroundColor: inRange ? color.accent.subtle : 'transparent',
                  },
                  isStart && {
                    borderTopLeftRadius: radius.pill,
                    borderBottomLeftRadius: radius.pill,
                  },
                  isEnd && {
                    borderTopRightRadius: radius.pill,
                    borderBottomRightRadius: radius.pill,
                  },
                ]}
              >
                <View
                  style={{
                    width: DISC,
                    height: DISC,
                    borderRadius: DISC / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: discBg,
                  }}
                >
                  <DSText variant="caption" style={{ color: numColor, fontWeight: numWeight }}>
                    {day}
                  </DSText>
                </View>

                {/* Zona de marcas: puntos de plata y/o badge de pedidos. */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    marginTop: 2,
                    minHeight: 8,
                  }}
                >
                  {showIncomeDot ? (
                    <View
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: DOT / 2,
                        backgroundColor: color.success.base,
                      }}
                    />
                  ) : null}
                  {showExpenseDot ? (
                    <View
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: DOT / 2,
                        backgroundColor: color.danger.base,
                      }}
                    />
                  ) : null}
                  {showOrders ? (
                    <View
                      style={{
                        paddingHorizontal: 5,
                        height: 14,
                        borderRadius: radius.pill,
                        backgroundColor: color.accent.subtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DSText variant="micro" color="accent" style={{ lineHeight: 14 }}>
                        {d?.ordersCount}
                      </DSText>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
