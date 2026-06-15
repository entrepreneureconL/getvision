/**
 * <Chip /> — badge / tag pequeño con variantes semánticas.
 *
 * Reemplaza el "Datos parciales" del HeroMetricCard actual y otros badges
 * que aparecen como `<View style={{ borderColor, borderWidth, padding... }}>`.
 *
 * Variantes:
 *   neutral  → bg subtle + borde subtle → "Hoy", "Ayer"
 *   accent   → tint azul → "Nuevo", "Activo"
 *   success  → tint verde → "Cobrado", "OK"
 *   danger   → tint rojo → "Vencido", "Error"
 *   warning  → tint naranja → "Datos parciales", "Pendiente"
 *   info     → tint violeta → futuro
 *
 * Tamaños:
 *   sm → padding 4×8, text xs
 *   md → padding 6×10, text sm
 *
 * Uso:
 *   <Chip variant="warning">Datos parciales</Chip>
 *   <Chip variant="success" size="sm">+ $ 65.000</Chip>
 *   <Chip variant="neutral" onPress={openFilter}>Mes</Chip>
 */

import { View, Pressable, type ViewStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import { color, radius, space } from '../tokens';
import { useHover } from '../useHover';
import DSText from './Text';

type Variant = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';
type Size = 'sm' | 'md';

type Props = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Si está presente, vuelve el chip tappable. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

type Tint = { bg: string; text: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning' };

const VARIANT_MAP: Record<Variant, Tint> = {
  neutral: { bg: color.bg.elevated, text: 'secondary' },
  accent: { bg: color.accent.subtle, text: 'accent' },
  success: { bg: color.success.subtle, text: 'success' },
  danger: { bg: color.danger.subtle, text: 'danger' },
  warning: { bg: color.warning.subtle, text: 'warning' },
  info: { bg: color.info.subtle, text: 'secondary' }, // si hace falta, agregamos 'info' en Text.
};

const SIZE_PADDING: Record<Size, { v: number; h: number }> = {
  sm: { v: space['1'], h: space['2'] },
  md: { v: space['1'], h: space['3'] },
};

export default function Chip({
  children,
  variant = 'neutral',
  size = 'sm',
  onPress,
  style,
}: Props) {
  const tint = VARIANT_MAP[variant];
  const pad = SIZE_PADDING[size];

  const chipStyle: StyleProp<ViewStyle> = [
    {
      alignSelf: 'flex-start',
      backgroundColor: tint.bg,
      borderRadius: radius.pill,
      paddingVertical: pad.v,
      paddingHorizontal: pad.h,
    },
    style,
  ];

  const content = (
    <DSText variant={size === 'sm' ? 'micro' : 'captionStrong'} color={tint.text}>
      {children}
    </DSText>
  );

  if (onPress) {
    return (
      <PressableChip onPress={onPress} base={chipStyle}>
        {content}
      </PressableChip>
    );
  }

  return <View style={chipStyle}>{content}</View>;
}

/**
 * D-20.a — Chip tappable con hover: sube a bg.elevated bajo el cursor (web),
 * señal de que es clickeable. Native: pressed feedback, hover nunca dispara.
 */
function PressableChip({
  children,
  onPress,
  base,
}: {
  children: ReactNode;
  onPress: () => void;
  base: StyleProp<ViewStyle>;
}) {
  const { hovered, hoverHandlers } = useHover();
  return (
    <Pressable
      onPress={onPress}
      {...hoverHandlers}
      style={({ pressed }) => [
        base,
        hovered ? { backgroundColor: color.bg.elevated } : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
