/**
 * <Card /> — contenedor visual con superficie elevada.
 *
 * El bloque atómico del lenguaje iPhone Screen Time. Cada hero metric, cada
 * sección, cada bloque de info va en una Card. NO usar borders — la elevación
 * se logra por contraste de fondo (bg.raised sobre bg.base).
 *
 * Variantes de superficie:
 *   surface   → bg.raised  (default, sobre el background de pantalla)
 *   elevated  → bg.elevated (card dentro de otra card)
 *   accent    → bg.subtle del accent (CTA suaves, contextos selectos)
 *
 * Padding:
 *   sm → 12  → cards densas (lista de items chicos)
 *   md → 16  → default
 *   lg → 20  → card hero con espacio respirable (default Apple)
 *   xl → 24  → onboarding / first-time
 *
 * Si pasás `onPress`, se vuelve tappable (TouchableOpacity).
 *
 * Uso:
 *   <Card padding="lg">
 *     <Heading level="display">$ 109.700</Heading>
 *     ...
 *   </Card>
 *
 *   <Card padding="md" onPress={openDetail}>
 *     ...
 *   </Card>
 */

import {
  View,
  Pressable,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import type { ReactNode } from 'react';
import { color, radius, space, shadow } from '../tokens';
import { useHover } from '../useHover';

type SurfaceVariant = 'surface' | 'elevated' | 'accent';
type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
type RadiusVariant = 'md' | 'lg' | 'xl';
type ShadowVariant = 'none' | 'subtle' | 'raised';

type Props = {
  children: ReactNode;
  variant?: SurfaceVariant;
  padding?: Padding;
  /** Default: 'lg' (14px) — el radio que se ve en iPhone Screen Time. */
  rounded?: RadiusVariant;
  /** Sombra. Default: 'none' (la elevación viene del color, no de la sombra). */
  shadow?: ShadowVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const PADDING_MAP: Record<Padding, number> = {
  none: 0,
  sm: space['3'],   // 12
  md: space['4'],   // 16
  lg: space['5'],   // 20
  xl: space['6'],   // 24
};

const VARIANT_BG: Record<SurfaceVariant, string> = {
  surface: color.bg.raised,
  elevated: color.bg.elevated,
  accent: color.accent.subtle,
};

const SHADOW_MAP = {
  none: shadow.none,
  subtle: shadow.subtle,
  raised: shadow.raised,
} as const;

export default function Card({
  children,
  variant = 'surface',
  padding = 'lg',
  rounded = 'lg',
  shadow: shadowVariant = 'none',
  onPress,
  style,
}: Props) {
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: VARIANT_BG[variant],
      borderRadius: radius[rounded],
      padding: PADDING_MAP[padding],
    },
    SHADOW_MAP[shadowVariant],
    style,
  ];

  if (onPress) {
    return <InteractiveCard onPress={onPress} variant={variant} base={cardStyle}>{children}</InteractiveCard>;
  }

  return <View style={cardStyle}>{children}</View>;
}

/**
 * D-20.a — Card tappable con hover (web): sube de superficie (bg.elevated) y
 * gana sombra (shadow.raised) bajo el cursor — el "se levanta al pasar el
 * mouse" pedido por el CEO. La variante `surface` cambia su bg; las demás
 * conservan su tinte y solo ganan sombra (no perder identidad). Native: pressed
 * feedback (antes activeOpacity 0.85), hover nunca dispara.
 */
function InteractiveCard({
  children,
  onPress,
  variant,
  base,
}: {
  children: ReactNode;
  onPress: () => void;
  variant: SurfaceVariant;
  base: StyleProp<ViewStyle>;
}) {
  const { hovered, hoverHandlers } = useHover();
  return (
    <Pressable
      onPress={onPress}
      {...hoverHandlers}
      style={({ pressed }) => [
        base,
        hovered ? shadow.raised : null,
        hovered && variant === 'surface' ? { backgroundColor: color.bg.elevated } : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
