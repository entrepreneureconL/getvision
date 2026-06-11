/**
 * <ProportionList /> — lista con barras de proporción (primitivo #13, D-6).
 *
 * El patrón "Most Used" de iPhone Screen Time aplicado a plata: cada fila
 * lleva una barrita horizontal cuyo ancho es su porcentaje del total —
 * ranking visual sin pedir que el usuario compare números (GETVISION_DESIGN
 * §4.3 "barras de proporción en listas").
 *
 * Genérico y puro como todo el DS: recibe items ya formateados (el caller
 * resuelve labels, montos y porcentajes — este componente solo dibuja).
 * Implementación: la barra es un View con width '<pct>%' — cero medición,
 * paridad web/native por construcción (lección LESSONS #8).
 *
 * Uso:
 *   <ProportionList
 *     tint={color.success.base}
 *     items={lines.map(l => ({
 *       key: l.key, label: l.label,
 *       valueLabel: `$ ${formatMoney(l.amount)}`, percent: l.percent,
 *     }))}
 *     onItemPress={(key) => ...}
 *   />
 */

import { View, TouchableOpacity } from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';

export type ProportionItem = {
  key: string;
  label: string;
  /** Valor ya formateado ("$ 198.500,00"). El DS no formatea moneda. */
  valueLabel: string;
  /** 0-100. Ancho de la barra. */
  percent: number;
  /** Color puntual de ESTA barra (pisa el tint general). */
  tint?: string;
  /** Fila atenuada (ej. "Sin etiqueta"). */
  dimmed?: boolean;
};

type Props = {
  items: ProportionItem[];
  /** Color default de las barras. */
  tint?: string;
  onItemPress?: (key: string, label: string) => void;
};

export default function ProportionList({
  items,
  tint = color.accent.base,
  onItemPress,
}: Props) {
  return (
    <View style={{ gap: space['3'] }}>
      {items.map(item => {
        const row = (
          <View key={item.key}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: space['1'],
              }}
            >
              <DSText
                variant="caption"
                color={item.dimmed ? 'tertiary' : 'secondary'}
                numberOfLines={1}
                style={{ flex: 1, marginRight: space['2'] }}
              >
                {item.label}
              </DSText>
              <DSText
                variant="caption"
                color={item.dimmed ? 'tertiary' : 'primary'}
                style={{ fontWeight: tokenText.weight.medium as '500' }}
              >
                {item.valueLabel}
              </DSText>
            </View>
            {/* Pista + barra. Mín 2% para que algo chico siga siendo visible. */}
            <View
              style={{
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: color.bg.elevated,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(Math.min(item.percent, 100), 2)}%`,
                  height: '100%',
                  borderRadius: radius.pill,
                  backgroundColor: item.tint ?? tint,
                  opacity: item.dimmed ? 0.4 : 1,
                }}
              />
            </View>
          </View>
        );

        if (!onItemPress) return row;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onItemPress(item.key, item.label)}
            activeOpacity={0.7}
          >
            {row}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
