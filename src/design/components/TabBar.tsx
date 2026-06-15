/**
 * <TabBar /> — barra de navegación inferior iOS-style (primitivo #11, D-4).
 *
 * ADR #13: bottom tabs con 4 destinos fijos. Esta es la versión 8.2 del plan
 * F1-D (componente custom); la migración a expo-router (8.3) queda diferida
 * hasta que el conteo de pantallas la justifique.
 *
 * Visual (espíritu iOS / GETVISION_DESIGN §3.2 "la navegación cede
 * protagonismo al contenido"):
 *   - bg.raised con borde superior subtle — flota apenas sobre el fondo.
 *   - Ítem activo: ícono filled + label en accent. Inactivos: outline + tertiary.
 *   - Touch targets de toda la columna (≥ 44pt).
 *
 * Presentacional puro: recibe items + activo + onChange. El estado vive en
 * el contenedor (MainTabs). No sabe de pantallas ni de navegación.
 */

import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space, text as tokenText } from '../tokens';
import { useHover } from '../useHover';
import DSText from './Text';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Nombre Ionicons para estado inactivo (variante -outline). */
  icon: keyof typeof Ionicons.glyphMap;
  /** Nombre Ionicons para estado activo (variante filled). */
  iconActive: keyof typeof Ionicons.glyphMap;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
};

export default function TabBar<T extends string>({ items, active, onChange }: Props<T>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: color.bg.raised,
        borderTopWidth: 1,
        borderTopColor: color.border.subtle,
        paddingTop: space['2'],
        // Espacio extra abajo para home-indicator / gestos (safe area simple).
        paddingBottom: space['3'],
      }}
    >
      {items.map(item => (
        <TabBarItem
          key={item.key}
          item={item}
          isActive={item.key === active}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}

/**
 * Un ítem de la TabBar. Extraído para usar `useHover` por ítem (D-20.a): el
 * inactivo sube de text.tertiary → text.primary bajo el cursor (web). El activo
 * (accent) no cambia. Native: hover nunca dispara.
 */
function TabBarItem<T extends string>({
  item,
  isActive,
  onPress,
}: {
  item: TabItem<T>;
  isActive: boolean;
  onPress: () => void;
}) {
  const { hovered, hoverHandlers } = useHover();
  const tint = isActive
    ? color.accent.base
    : hovered
      ? color.text.primary
      : color.text.tertiary;
  return (
    <Pressable
      onPress={onPress}
      {...hoverHandlers}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: space['1'],
        borderRadius: radius.md,
        backgroundColor: !isActive && hovered ? color.accent.subtle : 'transparent',
      }}
    >
      <Ionicons
        name={isActive ? item.iconActive : item.icon}
        size={22}
        color={tint}
      />
      <DSText
        variant="micro"
        style={{
          color: tint,
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
