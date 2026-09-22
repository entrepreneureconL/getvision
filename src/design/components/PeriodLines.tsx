/**
 * <PeriodLines /> — gráfico de LÍNEAS del período (P-018, decisión CEO 21-09-2026).
 *
 * Dos líneas: ingresos (success ↑) y costos (danger ↓), ambas positivas desde
 * una base común — responde "¿la tendencia va bien?" de un vistazo. Reemplaza a
 * <PeriodBars/> en la card de Inicio; PeriodBars se mantiene para Stats.
 *
 * Por qué react-native-svg (excepción controlada a ADR #12):
 *   Una diagonal suave necesita coordenadas; con Views planos no se puede sin
 *   medir el ancho, y onLayout no dispara confiable en RN-web 0.21 (LESSONS #8).
 *   `<Svg viewBox>` escala solo al contenedor → sin medición. `preserveAspect
 *   Ratio="none"` estira el viewBox al ancho real; `vectorEffect="non-scaling-
 *   stroke"` mantiene el grosor de línea constante pese al estiramiento.
 *
 * Interacción (CEO: "tap para el detalle, en mobile no hay hover"):
 *   Overlay de columnas Pressable (una por punto). Hover (web) o tap (mobile)
 *   marca el punto activo → caption con label + montos arriba del gráfico y una
 *   guía vertical tenue en la columna. Sin markers en el SVG (bajo
 *   preserveAspectRatio="none" un Circle se deforma en elipse).
 *
 * Sin línea de promedio en el gráfico (CEO): el promedio va como mensaje aparte.
 * < 2 puntos reales → serie DEMO con tag "Ejemplo" (usuarios nuevos nunca ven un
 * gráfico vacío).
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { color, space } from '../tokens';
import DSText from './Text';

export type PeriodLinePoint = {
  /** Key estable (ej. fecha ISO o clave de semana). */
  key: string;
  /** Label del eje X (ej. "31/08"). */
  label: string;
  /** Ingresos del bucket. >= 0. */
  up: number;
  /** Costos del bucket. >= 0. */
  down: number;
  /** true → label del eje enfatizado (bucket actual). */
  emphasized?: boolean;
};

/** Lado del viewBox — coords internas 0..VB; el SVG escala al contenedor. */
const VB = 100;

/** Serie de ejemplo para usuarios sin datos (CEO: mostrar demo, no vacío). */
const DEMO: PeriodLinePoint[] = [
  { key: 'demo1', label: '31/08', up: 42, down: 30 },
  { key: 'demo2', label: '07/09', up: 55, down: 34 },
  { key: 'demo3', label: '14/09', up: 48, down: 41 },
  { key: 'demo4', label: '21/09', up: 71, down: 46 },
  { key: 'demo5', label: '28/09', up: 63, down: 39, emphasized: true },
];

type Props = {
  points: PeriodLinePoint[];
  /** Altura de la zona de líneas (px). Default 132. */
  height?: number;
  /** Formateador de montos para el caption. Sin esto, el caption no muestra $. */
  formatMoney?: (n: number) => string;
};

export default function PeriodLines({ points, height = 132, formatMoney }: Props) {
  const isDemo = points.length < 2;
  const data = isDemo ? DEMO : points;
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const n = data.length;
  const max = Math.max(...data.flatMap(p => [p.up, p.down]), 1);
  const xAt = (i: number) => (n === 1 ? VB / 2 : (i / (n - 1)) * VB);
  const yAt = (v: number) => VB - (v / max) * VB;
  const polyline = (sel: (p: PeriodLinePoint) => number) =>
    data.map((p, i) => `${xAt(i)},${yAt(sel(p))}`).join(' ');

  const active = data.find(p => p.key === activeKey) ?? null;

  return (
    <View>
      {/* Caption del punto activo — el dato sin depender del hover (mobile). */}
      <View style={styles.caption}>
        {active && formatMoney ? (
          <View style={styles.captionRow}>
            <DSText variant="micro" color="secondary">{active.label}</DSText>
            <DSText variant="micro" style={{ color: color.success.base }}>
              ↑ $ {formatMoney(active.up)}
            </DSText>
            <DSText variant="micro" style={{ color: color.danger.base }}>
              ↓ $ {formatMoney(active.down)}
            </DSText>
          </View>
        ) : null}
      </View>

      <View style={{ height }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none">
          <Polyline
            points={polyline(p => p.up)}
            fill="none"
            stroke={color.success.base}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <Polyline
            points={polyline(p => p.down)}
            fill="none"
            stroke={color.danger.base}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>

        {/* Overlay interactivo: una columna por punto. Guía vertical tenue en la
            activa. Sin coords en px → cross-platform, sin medición. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {data.map(p => (
            <Pressable
              key={p.key}
              style={[styles.col, p.key === activeKey && styles.colActive]}
              onHoverIn={() => setActiveKey(p.key)}
              onHoverOut={() => setActiveKey(k => (k === p.key ? null : k))}
              onPress={() => setActiveKey(k => (k === p.key ? null : p.key))}
            />
          ))}
        </View>
      </View>

      {/* Eje X */}
      <View style={styles.axis}>
        {data.map(p => (
          <View key={p.key} style={styles.axisCell}>
            <DSText variant="micro" color={p.emphasized ? 'primary' : 'tertiary'}>
              {p.label}
            </DSText>
          </View>
        ))}
      </View>

      {isDemo ? (
        <DSText variant="micro" color="tertiary" align="center" style={{ marginTop: space['1'] }}>
          Ejemplo — cargá movimientos para ver tus líneas
        </DSText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { minHeight: 18, marginBottom: space['1'], justifyContent: 'center' },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space['3'],
  },
  col: { flex: 1 },
  colActive: { backgroundColor: 'rgba(255,255,255,0.04)' },
  axis: { flexDirection: 'row', marginTop: space['1'] },
  axisCell: { flex: 1, alignItems: 'center' },
});
