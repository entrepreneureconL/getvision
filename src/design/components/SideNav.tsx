/**
 * <SideNav /> — navegación lateral de escritorio (primitivo #12, D-15 paso 2).
 *
 * Contraparte desktop de <TabBar/>: mismos TabItem, mismo contrato
 * (items + active + onChange), distinta forma. En pantallas anchas la
 * navegación inferior es un patrón de teléfono (pulgar); en escritorio el
 * estándar es la barra lateral (referencia CEO: CoinMarketCap).
 *
 * Visual:
 *   - Columna fija de 224px, bg.raised, borde derecho subtle.
 *   - Marca arriba ("Get" teal + "Vision" blanco — como el logo).
 *   - Ítems: fila ícono+label, activo con fondo accent.subtle + texto accent.
 *
 * Presentacional puro, igual que TabBar. El contenedor (MainTabs) decide
 * cuál de los dos renderizar según el breakpoint.
 */

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';
import type { TabItem } from './TabBar';

type Props<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
};

export default function SideNav<T extends string>({ items, active, onChange }: Props<T>) {
  return (
    <View
      style={{
        width: 224,
        backgroundColor: color.bg.raised,
        borderRightWidth: 1,
        borderRightColor: color.border.subtle,
        paddingHorizontal: space['3'],
        paddingTop: space['8'],
      }}
    >
      {/* ── Marca ── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: space['3'], marginBottom: space['8'] }}>
        <DSText
          style={{
            color: color.accent.base,
            fontSize: tokenText.size.xl,
            fontWeight: tokenText.weight.bold as '700',
          }}
        >
          Get
        </DSText>
        <DSText
          style={{
            color: color.text.primary,
            fontSize: tokenText.size.xl,
            fontWeight: tokenText.weight.bold as '700',
          }}
        >
          Vision
        </DSText>
      </View>

      {/* ── Ítems ── */}
      <View style={{ gap: space['1'] }}>
        {items.map(item => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onChange(item.key)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space['3'],
                paddingVertical: space['3'],
                paddingHorizontal: space['3'],
                borderRadius: radius.md,
                backgroundColor: isActive ? color.accent.subtle : 'transparent',
              }}
            >
              <Ionicons
                name={isActive ? item.iconActive : item.icon}
                size={20}
                color={isActive ? color.accent.base : color.text.tertiary}
              />
              <DSText
                variant="bodyStrong"
                style={{
                  color: isActive ? color.accent.base : color.text.secondary,
                  fontWeight: (isActive
                    ? tokenText.weight.semibold
                    : tokenText.weight.medium) as '600' | '500',
                }}
              >
                {item.label}
              </DSText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
