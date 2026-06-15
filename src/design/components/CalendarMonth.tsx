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
 *   - D-23.a — Pedidos VENCIDOS: un pedido `pending` con fecha ya pasada es un
 *     compromiso incumplido, no un compromiso futuro. Badge en familia `warning`
 *     (≠ del badge `accent` de pedidos futuros) — el calendario no puede ocultar
 *     una entrega que se pasó (P-016.a, extiende ADR #20 a compromisos).
 *   - D-23.a — Navegación de mes: el primitivo sigue TONTO. Recibe callbacks
 *     opcionales `onPrevMonth`/`onNextMonth`/`onToday` y solo dibuja los
 *     controles; el padre maneja el ancla y recarga los datos del mes.
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
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space } from '../tokens';
import { parseLocalISODate, toLocalISODate, todayLocalISO } from '../../utils/periods';
import { useHover } from '../useHover';
import DSText from './Text';
import Tooltip from './Tooltip';

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
  /** D-23.a — mes anterior (chevron ‹). Sin esto, el chevron no se dibuja. */
  onPrevMonth?: () => void;
  /** D-23.a — mes siguiente (chevron ›). Sin esto, el chevron no se dibuja. */
  onNextMonth?: () => void;
  /** D-23.a — volver al mes actual. El padre lo pasa SOLO si el ancla no es el
   *  mes de hoy (botón "Hoy" visible únicamente cuando hay a dónde volver). */
  onToday?: () => void;
  /** D-20.a — formateador de montos para el tooltip de hover (web). El padre
   *  pasa su `formatMoney` (el DS no importa de components). Sin esto, sin
   *  tooltip (degradación limpia). */
  formatMoney?: (n: number) => string;
  /** D-23.b1 — ampliar a la vista expandida (`<CalendarMonthExpanded/>`). Sin
   *  esto, no se dibuja el ícono (degradación limpia). Simétrico al "contraer"
   *  de la expandida. */
  onExpand?: () => void;
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
  onPrevMonth,
  onNextMonth,
  onToday,
  formatMoney,
  onExpand,
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
      {/* Header — D-23.a: mes + navegación opcional (‹ ›) + "Hoy". El primitivo
          solo dibuja los controles cuyos callbacks recibe (sigue tonto). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: space['2'],
        }}
      >
        <DSText variant="bodyStrong">{monthYearLabel(anchorDate)}</DSText>
        <View style={{ flex: 1 }} />
        {onToday ? (
          <Pressable
            onPress={onToday}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              paddingHorizontal: space['2'],
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: color.accent.subtle,
              marginRight: space['1'],
            }}
          >
            <DSText variant="micro" color="accent">
              Hoy
            </DSText>
          </Pressable>
        ) : null}
        {onPrevMonth ? (
          <Pressable
            onPress={onPrevMonth}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-back" size={18} color={color.text.secondary} />
          </Pressable>
        ) : null}
        {onNextMonth ? (
          <Pressable
            onPress={onNextMonth}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-forward" size={18} color={color.text.secondary} />
          </Pressable>
        ) : null}
        {onExpand ? (
          <Pressable
            onPress={onExpand}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{ padding: 4, marginLeft: space['1'] }}
            accessibilityLabel="Ampliar calendario"
          >
            <Ionicons name="expand-outline" size={17} color={color.text.secondary} />
          </Pressable>
        ) : null}
      </View>

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
          return (
            <DayCell
              key={iso}
              day={day}
              iso={iso}
              data={dataByDate.get(iso)}
              today={today}
              selection={selection}
              onDayPress={onDayPress}
              formatMoney={formatMoney}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * Una celda de día. Extraída para usar `useHover` por celda (D-20.a): bajo el
 * cursor (web) la celda interactiva sube a bg.elevated y, si tiene datos,
 * muestra un <Tooltip/> con los montos del día — el "datos sobre el objeto al
 * pasar el mouse" pedido por el CEO. Principio #8: solo las celdas REALMENTE
 * accionables muestran hover (pasado/hoy = seleccionable; futuro con pedidos =
 * agenda; futuro vacío = no-op, sin hover). Native: hover nunca dispara.
 */
function DayCell({
  day,
  iso,
  data,
  today,
  selection,
  onDayPress,
  formatMoney,
}: {
  day: number;
  iso: string;
  data?: CalendarDayData;
  today: string;
  selection: { start: string; end: string } | null;
  onDayPress?: (date: string) => void;
  formatMoney?: (n: number) => string;
}) {
  const { hovered, hoverHandlers } = useHover({ delay: 250 });

  const isToday = iso === today;
  const isFuture = iso > today;

  const inRange = selection != null && iso >= selection.start && iso <= selection.end;
  const isStart = selection != null && iso === selection.start;
  const isEnd = selection != null && iso === selection.end;
  const isEdge = isStart || isEnd;

  // Puntos de PLATA — solo si el día ya ocurrió (ADR #20).
  const showIncomeDot = !isFuture && (data?.income ?? 0) > 0;
  const showExpenseDot = !isFuture && (data?.expense ?? 0) > 0;
  // Marca de PEDIDOS pending por día de entrega. La RPC cuenta solo 'pending'
  // (los entregados ya son puntos de plata), sin filtrar fecha → un pending en
  // un día pasado es un VENCIDO.
  const hasOrders = (data?.ordersCount ?? 0) > 0;
  const showFutureOrders = (isFuture || isToday) && hasOrders;
  // D-23.a — Compromiso incumplido (pasado): badge warning (P-016.a).
  const showOverdueOrders = !isFuture && !isToday && hasOrders;
  const showOrders = showFutureOrders || showOverdueOrders;

  // Principio #8: la celda es accionable si el padre dio onDayPress y el día
  // no es futuro-vacío (ese caso es no-op en handleCalendarDayPress).
  const isInteractive = !!onDayPress && (!isFuture || hasOrders);

  // Tooltip (web): montos del día + pedidos. Solo si hay datos y formatter.
  const tipParts: string[] = [];
  if (formatMoney) {
    if (showIncomeDot) tipParts.push(`↑ $ ${formatMoney(data!.income)}`);
    if (showExpenseDot) tipParts.push(`↓ $ ${formatMoney(data!.expense)}`);
    if (showOrders) {
      const n = data!.ordersCount;
      tipParts.push(showOverdueOrders ? `${n} ${n === 1 ? 'vencido' : 'vencidos'}` : `${n} ped.`);
    }
  }
  const tipLabel = tipParts.join(' · ');
  const showTip = isInteractive && tipLabel.length > 0;

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

  // Fondo de la banda: la selección manda; si no, hover de celda interactiva.
  const bandHover = hovered && isInteractive && !inRange;

  return (
    <Pressable
      onPress={onDayPress ? () => onDayPress(iso) : undefined}
      disabled={!onDayPress}
      {...hoverHandlers}
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
            backgroundColor: inRange
              ? color.selection.subtle
              : bandHover
                ? color.bg.elevated
                : 'transparent',
          },
          bandHover && { borderRadius: radius.md },
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
                backgroundColor: showOverdueOrders ? color.warning.subtle : color.info.subtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DSText
                variant="micro"
                style={{
                  lineHeight: 14,
                  color: showOverdueOrders ? color.warning.base : color.info.base,
                }}
              >
                {data?.ordersCount}
              </DSText>
            </View>
          ) : null}
        </View>
      </View>

      <Tooltip visible={hovered && showTip} label={tipLabel} />
    </Pressable>
  );
}
