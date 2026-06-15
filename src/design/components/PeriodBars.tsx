/**
 * <PeriodBars /> — gráfico de barras del período (primitivo #10 del DS).
 *
 * El patrón visual de iPhone Screen Time aplicado a plata: una barra por día,
 * línea punteada con el promedio diario del período anterior ("tu normal"),
 * y el día de hoy enfatizado. Responde "¿hoy/esta semana vengo bien?" sin
 * leer un solo número.
 *
 * Espejado vertical (decisión GETVISION_DESIGN §4.3):
 *   - Ingresos crecen HACIA ARRIBA desde la línea base, en success.
 *   - Costos crecen HACIA ABAJO, en danger.
 *   Honestidad numérica (ADR #20): los dos flujos se ven, ninguno se esconde.
 *
 * Implementación 100% Views + StyleSheet — CERO librerías de charts (ADR #12,
 * TECH §7 "sin librería UI externa"). La línea punteada se dibuja con
 * segmentos View (no `borderStyle: 'dashed'`, que en Android no renderiza
 * con borde de un solo lado). Se renderiza una cantidad FIJA de guiones y el
 * contenedor con `overflow: 'hidden'` recorta el sobrante — sin onLayout ni
 * medición (onLayout demostró no disparar en RN-web 0.21 durante D-2).
 * Paridad web/native garantizada por construcción.
 *
 * Reglas de render:
 *   - < 2 puntos → null (un día solo no es un gráfico).
 *   - Valores > 0 que escalan a < 2px se clampean a 2px (visibles siempre).
 *   - Días pasados al 45% de opacidad; HOY a opacidad plena (efecto Screen
 *     Time: "mirá tu barra de hoy").
 *   - La línea "prom" solo aparece si avgLine > 0.
 *
 * Uso:
 *   <PeriodBars
 *     points={series.map(p => ({ key: p.date, label: p.label, up: p.income,
 *                                down: p.expense, emphasized: p.isToday }))}
 *     avgLine={prevDailyAvgIncome}
 *     avgLabel="prom"
 *   />
 */

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';
import Tooltip from './Tooltip';

export type PeriodBarPoint = {
  /** Key estable (ej. fecha ISO). */
  key: string;
  /** Label del eje X. '' = sin label (eje espaciado en vistas densas). */
  label: string;
  /** Magnitud hacia arriba (ingresos). >= 0. */
  up: number;
  /** Magnitud hacia abajo (costos). >= 0. */
  down: number;
  /** true → barra a opacidad plena (hoy). El resto va atenuado. */
  emphasized?: boolean;
};

type Props = {
  points: PeriodBarPoint[];
  /** Línea punteada de referencia, en unidades de `up`. No se dibuja si <= 0. */
  avgLine?: number;
  /** Texto al extremo derecho de la línea. Default: "prom". */
  avgLabel?: string;
  /** Altura total de la zona de barras (px). Default 96. */
  height?: number;
  /** D-20.a — formateador de montos para el tooltip de hover (web). Sin esto,
   *  la barra resalta en hover pero no muestra burbuja (degradación limpia). */
  formatMoney?: (n: number) => string;
  /** Item 5 — 'mirrored' (default, espejado ↑ingresos/↓costos) o 'grouped'
   *  (barras positivas lado a lado + líneas "Prom del mes" por serie). */
  layout?: 'mirrored' | 'grouped';
};

/** Factor de atenuación de las columnas NO apuntadas mientras hay hover (web). */
const HOVER_DIM = 0.55;

const DIM_OPACITY = 0.45;
const MIN_BAR_PX = 2;
const DASH_W = 4;
const DASH_GAP = 4;
/** Guiones fijos: cubren ~640px de ancho; overflow:hidden recorta el resto. */
const DASH_COUNT = 80;
/** Ancho reservado a la derecha para el label "prom" (eje estilo Screen Time). */
const AVG_LABEL_W = 36;

export default function PeriodBars({
  points,
  avgLine = 0,
  avgLabel = 'prom',
  height = 96,
  formatMoney,
  layout = 'mirrored',
}: Props) {
  // D-20.a — qué columna está bajo el cursor (web). Vive en el padre porque la
  // atenuación del RESTO de las barras depende de cuál se apunta.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (points.length < 2) return null;

  // ─────────────────────────────────────────────────────────────────────
  // Item 5 — modo agrupado (dashboard chart A): ingresos y costos como par
  // POSITIVO lado a lado, ambos desde una base común (cero negativos). Dos
  // líneas "Prom del mes" (promedio de los buckets del período): ingresos
  // verde, costos rojo. Honestidad numérica (ADR #20): que ingresos > costos
  // se lea de un vistazo.
  // ─────────────────────────────────────────────────────────────────────
  if (layout === 'grouped') {
    const dataMax = Math.max(...points.map(p => Math.max(p.up, p.down)));
    const gIsFlat = dataMax === 0;
    const avgUp = points.reduce((s, p) => s + p.up, 0) / points.length;
    const avgDown = points.reduce((s, p) => s + p.down, 0) / points.length;
    const gMax = Math.max(dataMax, avgUp, avgDown, 1);
    const gScale = gIsFlat ? 0 : height / gMax;
    const gpx = (v: number) => (v <= 0 ? 0 : Math.max(v * gScale, MIN_BAR_PX));
    const gBarW = points.length > 10 ? 4 : points.length > 6 ? 7 : 10;
    const gGap = points.length > 10 ? 1 : 2;
    const avgUpTop = height - avgUp * gScale;
    const avgDownTop = height - avgDown * gScale;

    return (
      <View>
        <View style={{ height }}>
          {/* Columnas: cada período = par (ingreso | costo) desde la base. */}
          <View style={{ flexDirection: 'row', height }}>
            {points.map(p => {
              const base = p.emphasized ? 1 : DIM_OPACITY;
              const isHov = p.key === hoveredKey;
              const opacity = hoveredKey === null ? base : isHov ? 1 : base * HOVER_DIM;
              return (
                <GroupedColumn
                  key={p.key}
                  point={p}
                  opacity={opacity}
                  isHovered={isHov}
                  barW={gBarW}
                  gap={gGap}
                  height={height}
                  upPx={gpx(p.up)}
                  downPx={gpx(p.down)}
                  formatMoney={formatMoney}
                  onHoverIn={() => setHoveredKey(p.key)}
                  onHoverOut={() => setHoveredKey(prev => (prev === p.key ? null : prev))}
                />
              );
            })}
          </View>

          {/* Base común de las barras */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: color.border.default,
            }}
          />

          {/* Líneas "Prom del mes": ingresos (verde) y costos (rojo). */}
          {!gIsFlat && avgUp > 0 ? <DashedLine top={avgUpTop} tint={color.success.base} /> : null}
          {!gIsFlat && avgDown > 0 ? <DashedLine top={avgDownTop} tint={color.danger.base} /> : null}
        </View>

        {/* Eje X */}
        <View style={{ flexDirection: 'row', marginTop: space['1'] }}>
          {points.map(p => (
            <View key={p.key} style={{ flex: 1, alignItems: 'center' }}>
              <DSText variant="micro" color={p.emphasized ? 'primary' : 'tertiary'}>
                {p.label}
              </DSText>
            </View>
          ))}
        </View>

        {gIsFlat ? (
          <DSText variant="micro" color="tertiary" align="center" style={{ marginTop: space['1'] }}>
            Sin movimientos en este período.
          </DSText>
        ) : null}
      </View>
    );
  }

  const maxUp = Math.max(...points.map(p => p.up), avgLine);
  const maxDown = Math.max(...points.map(p => p.down));
  const isFlat = maxUp === 0 && maxDown === 0;

  // Reparto vertical proporcional: la zona de arriba y la de abajo comparten
  // la misma escala $/px para que una barra de ingresos y una de costos del
  // mismo monto midan igual (comparabilidad visual honesta).
  const scale = isFlat ? 0 : height / (maxUp + maxDown || 1);
  const upZone = isFlat ? height / 2 : maxUp * scale;
  const downZone = isFlat ? height / 2 : maxDown * scale;

  const barW = points.length > 12 ? 5 : 12;
  const showAvg = avgLine > 0 && !isFlat;
  const avgTop = upZone - avgLine * scale;

  const px = (value: number): number => {
    if (value <= 0) return 0;
    return Math.max(value * scale, MIN_BAR_PX);
  };

  return (
    <View>
      {/* ── Zona de gráfico ── */}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          {/* Columnas de barras */}
          <View style={{ flexDirection: 'row' }}>
            {points.map(p => {
              const base = p.emphasized ? 1 : DIM_OPACITY;
              const isHov = p.key === hoveredKey;
              // Con hover activo: la apuntada a opacidad plena, el resto recede.
              const opacity = hoveredKey === null ? base : isHov ? 1 : base * HOVER_DIM;
              return (
                <BarColumn
                  key={p.key}
                  point={p}
                  opacity={opacity}
                  isHovered={isHov}
                  barW={barW}
                  upZone={upZone}
                  downZone={downZone}
                  upPx={px(p.up)}
                  downPx={px(p.down)}
                  formatMoney={formatMoney}
                  onHoverIn={() => setHoveredKey(p.key)}
                  onHoverOut={() => setHoveredKey(prev => (prev === p.key ? null : prev))}
                />
              );
            })}
          </View>

          {/* Línea punteada de promedio — segmentos View fijos recortados por
              overflow:hidden. Sin medición → paridad garantizada. */}
          {showAvg ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: avgTop,
                height: 1,
                flexDirection: 'row',
                gap: DASH_GAP,
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: DASH_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: DASH_W,
                    height: 1,
                    backgroundColor: color.text.secondary,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Label del promedio, alineado a la línea (eje derecho Screen Time). */}
        {showAvg ? (
          <View style={{ width: AVG_LABEL_W, height: upZone + downZone + 1 }}>
            <DSText
              variant="micro"
              color="secondary"
              style={{
                position: 'absolute',
                top: Math.max(avgTop - tokenText.lineHeight.xs / 2, 0),
                right: 0,
              }}
            >
              {avgLabel}
            </DSText>
          </View>
        ) : null}
      </View>

      {/* ── Eje X ── */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: space['1'],
          marginRight: showAvg ? AVG_LABEL_W : 0,
        }}
      >
        {points.map(p => (
          <View key={p.key} style={{ flex: 1, alignItems: 'center' }}>
            <DSText
              variant="micro"
              color={p.emphasized ? 'primary' : 'tertiary'}
            >
              {p.label}
            </DSText>
          </View>
        ))}
      </View>

      {isFlat ? (
        <DSText
          variant="micro"
          color="tertiary"
          align="center"
          style={{ marginTop: space['1'] }}
        >
          Sin movimientos en este período.
        </DSText>
      ) : null}
    </View>
  );
}

/**
 * Una columna del gráfico (ingreso ↑ + costo ↓). Extraída para D-20.a: cada
 * columna es una zona de hover (web) que avisa al padre cuál está apuntada
 * (para atenuar el resto) y muestra un <Tooltip/> con la fecha + montos —
 * "datos sobre la barra posicionada" pedido por el CEO. El hover lo gobierna el
 * padre (no useHover) porque la atenuación es relativa entre columnas. Native:
 * `onHoverIn`/`onHoverOut` nunca disparan (paridad limpia).
 */
function BarColumn({
  point,
  opacity,
  isHovered,
  barW,
  upZone,
  downZone,
  upPx,
  downPx,
  formatMoney,
  onHoverIn,
  onHoverOut,
}: {
  point: PeriodBarPoint;
  opacity: number;
  isHovered: boolean;
  barW: number;
  upZone: number;
  downZone: number;
  upPx: number;
  downPx: number;
  formatMoney?: (n: number) => string;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const tip = formatMoney
    ? [
        point.label || null,
        point.up > 0 ? `↑ $ ${formatMoney(point.up)}` : null,
        point.down > 0 ? `↓ $ ${formatMoney(point.down)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Pressable
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View style={{ height: upZone, justifyContent: 'flex-end' }}>
        {point.up > 0 ? (
          <View
            style={{
              width: barW,
              height: upPx,
              backgroundColor: color.success.base,
              borderTopLeftRadius: radius.sm,
              borderTopRightRadius: radius.sm,
              opacity,
            }}
          />
        ) : null}
      </View>
      {/* Línea base por columna — juntas leen como un eje continuo. */}
      <View
        style={{
          alignSelf: 'stretch',
          height: 1,
          backgroundColor: color.border.default,
        }}
      />
      <View style={{ height: downZone }}>
        {point.down > 0 ? (
          <View
            style={{
              width: barW,
              height: downPx,
              backgroundColor: color.danger.base,
              borderBottomLeftRadius: radius.sm,
              borderBottomRightRadius: radius.sm,
              opacity,
            }}
          />
        ) : null}
      </View>

      <Tooltip visible={isHovered && tip.length > 0} label={tip} />
    </Pressable>
  );
}

/**
 * Línea punteada horizontal a `top` px (Item 5 — líneas "Prom del mes"). Misma
 * técnica que la línea "prom" del modo espejado: segmentos View fijos recortados
 * por overflow:hidden, sin medición → paridad web/native (LESSONS #8).
 */
function DashedLine({ top, tint }: { top: number; tint: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: 1,
        flexDirection: 'row',
        gap: DASH_GAP,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <View key={i} style={{ width: DASH_W, height: 1, backgroundColor: tint }} />
      ))}
    </View>
  );
}

/**
 * Una columna del modo agrupado (Item 5): par ingreso (verde) + costo (rojo),
 * ambos POSITIVOS creciendo desde la base. Misma mecánica de hover/Tooltip que
 * <BarColumn/> (D-20.a): avisa al padre cuál se apunta y muestra fecha + montos.
 */
function GroupedColumn({
  point,
  opacity,
  isHovered,
  barW,
  gap,
  height,
  upPx,
  downPx,
  formatMoney,
  onHoverIn,
  onHoverOut,
}: {
  point: PeriodBarPoint;
  opacity: number;
  isHovered: boolean;
  barW: number;
  gap: number;
  height: number;
  upPx: number;
  downPx: number;
  formatMoney?: (n: number) => string;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const tip = formatMoney
    ? [
        point.label || null,
        point.up > 0 ? `↑ $ ${formatMoney(point.up)}` : null,
        point.down > 0 ? `↓ $ ${formatMoney(point.down)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Pressable
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={{ flex: 1, height, justifyContent: 'flex-end' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap }}>
        <View
          style={{
            width: barW,
            height: upPx,
            backgroundColor: color.success.base,
            borderTopLeftRadius: radius.sm,
            borderTopRightRadius: radius.sm,
            opacity,
          }}
        />
        <View
          style={{
            width: barW,
            height: downPx,
            backgroundColor: color.danger.base,
            borderTopLeftRadius: radius.sm,
            borderTopRightRadius: radius.sm,
            opacity,
          }}
        />
      </View>

      <Tooltip visible={isHovered && tip.length > 0} label={tip} />
    </Pressable>
  );
}
