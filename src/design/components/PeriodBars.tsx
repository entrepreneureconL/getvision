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

import { View } from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';

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
};

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
}: Props) {
  if (points.length < 2) return null;

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
              const opacity = p.emphasized ? 1 : DIM_OPACITY;
              return (
                <View key={p.key} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ height: upZone, justifyContent: 'flex-end' }}>
                    {p.up > 0 ? (
                      <View
                        style={{
                          width: barW,
                          height: px(p.up),
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
                    {p.down > 0 ? (
                      <View
                        style={{
                          width: barW,
                          height: px(p.down),
                          backgroundColor: color.danger.base,
                          borderBottomLeftRadius: radius.sm,
                          borderBottomRightRadius: radius.sm,
                          opacity,
                        }}
                      />
                    ) : null}
                  </View>
                </View>
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
