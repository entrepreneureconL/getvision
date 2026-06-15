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

import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space, text as tokenText } from '../tokens';
import { useHover } from '../useHover';
import DSText from './Text';
import type { TabItem } from './TabBar';

type Props<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
};

export default function SideNav<T extends string>({ items, active, onChange }: Props<T>) {
  // Item 4: el último ítem (Perfil) se ancla al fondo del sidebar; el resto
  // queda agrupado arriba bajo la marca.
  const mainItems = items.slice(0, -1);
  const bottomItem = items.length > 0 ? items[items.length - 1] : undefined;
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

      {/* ── Ítems principales ── */}
      <View style={{ gap: space['1'] }}>
        {mainItems.map(item => (
          <SideNavItem
            key={item.key}
            item={item}
            isActive={item.key === active}
            onPress={() => onChange(item.key)}
          />
        ))}
      </View>

      {/* Empuja el último ítem (Perfil) al fondo del sidebar — patrón de
          escritorio "cuenta/perfil abajo" (ref. CoinMarketCap/iCloud). En móvil
          la TabBar ya lo tiene en la última posición (extremo derecho). [Item 4] */}
      <View style={{ flex: 1 }} />

      {bottomItem ? (
        <View style={{ gap: space['1'], paddingBottom: space['6'] }}>
          <SideNavItem
            key={bottomItem.key}
            item={bottomItem}
            isActive={bottomItem.key === active}
            onPress={() => onChange(bottomItem.key)}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Un ítem del SideNav. Extraído para usar `useHover` por ítem (D-20.a): el
 * inactivo gana fondo accent.subtle + texto/ícono text.primary bajo el cursor
 * (web). El activo (accent) no cambia. Native: hover nunca dispara.
 */
function SideNavItem<T extends string>({
  item,
  isActive,
  onPress,
}: {
  item: TabItem<T>;
  isActive: boolean;
  onPress: () => void;
}) {
  const { hovered, hoverHandlers } = useHover();
  const showHover = !isActive && hovered;
  const iconColor = isActive
    ? color.accent.base
    : showHover
      ? color.text.primary
      : color.text.tertiary;
  const labelColor = isActive
    ? color.accent.base
    : showHover
      ? color.text.primary
      : color.text.secondary;
  return (
    <Pressable
      onPress={onPress}
      {...hoverHandlers}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space['3'],
        paddingVertical: space['3'],
        paddingHorizontal: space['3'],
        borderRadius: radius.md,
        backgroundColor: isActive || showHover ? color.accent.subtle : 'transparent',
      }}
    >
      <Ionicons
        name={isActive ? item.iconActive : item.icon}
        size={20}
        color={iconColor}
      />
      <DSText
        variant="bodyStrong"
        style={{
          color: labelColor,
          fontWeight: (isActive
            ? tokenText.weight.semibold
            : tokenText.weight.medium) as '600' | '500',
        }}
      >
        {item.label}
      </DSText>
    </Pressable>
  );
}
