/**
 * <Button /> — botón con variantes y tamaños.
 *
 * Reemplaza el patrón `<TouchableOpacity><View style={...}><Text>...` que se
 * repite en cada pantalla con estilos distintos.
 *
 * Variantes:
 *   primary   → bg accent, texto inverse — CTA principal de la pantalla.
 *   secondary → bg surface, texto primary — acción importante secundaria.
 *   ghost     → bg transparente, texto accent — acción liviana inline.
 *   danger    → bg danger, texto white — destructive (eliminar, cancelar).
 *
 * Tamaños:
 *   sm → height 36, text sm   — botones inline en listas
 *   md → height 44, text md   — default
 *   lg → height 52, text lg   — CTA de pantalla (Welcome, Login)
 *
 * Estados manejados:
 *   - disabled       → opacidad 0.4, no responde a press
 *   - loading        → muestra spinner en lugar de label
 *   - fullWidth      → ocupa todo el ancho disponible
 *
 * Uso:
 *   <Button variant="primary" size="lg" onPress={signUp}>Comenzar gratis</Button>
 *   <Button variant="ghost" size="sm" onPress={goBack}>← Volver</Button>
 *   <Button variant="secondary" loading={saving} onPress={save}>Guardar</Button>
 */

import {
  Pressable,
  ActivityIndicator,
  Text,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import { useHover } from '../useHover';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  children: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Ícono opcional a la izquierda (string emoji o componente). */
  leftIcon?: string;
  /** Ícono opcional a la derecha. */
  rightIcon?: string;
  style?: StyleProp<ViewStyle>;
};

type Style = { container: ViewStyle; label: TextStyle };

const SIZE_STYLES: Record<Size, Style> = {
  sm: {
    container: {
      minHeight: 36,
      paddingHorizontal: space['3'],
      borderRadius: radius.md,
    },
    label: {
      fontSize: tokenText.size.sm,
      fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    },
  },
  md: {
    container: {
      minHeight: 44,
      paddingHorizontal: space['4'],
      borderRadius: radius.md,
    },
    label: {
      fontSize: tokenText.size.md,
      fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    },
  },
  lg: {
    container: {
      minHeight: 52,
      paddingHorizontal: space['5'],
      borderRadius: radius.lg,
    },
    label: {
      fontSize: tokenText.size.lg,
      fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    },
  },
};

const VARIANT_STYLES: Record<Variant, Style> = {
  primary: {
    container: { backgroundColor: color.accent.base },
    label: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: color.bg.raised },
    label: { color: color.text.primary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: color.accent.base },
  },
  danger: {
    container: { backgroundColor: color.danger.base },
    label: { color: '#FFFFFF' },
  },
};

/** D-20.a — fondo en hover (web). Native nunca lo dispara (useHover). */
const HOVER_BG: Record<Variant, string> = {
  primary: color.accent.hover,
  secondary: color.bg.elevated,
  ghost: color.accent.subtle,
  danger: color.danger.hover,
};

export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}: Props) {
  const sz = SIZE_STYLES[size];
  const vr = VARIANT_STYLES[variant];
  const isInactive = disabled || loading;
  const { hovered, hoverHandlers } = useHover();

  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      disabled={isInactive}
      {...hoverHandlers}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space['2'],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // Native conserva el feedback pressed (antes activeOpacity 0.85).
          opacity: isInactive ? 0.4 : pressed ? 0.85 : 1,
        },
        sz.container,
        vr.container,
        // Hover (web) — pisa el bg de la variante. Native: hovered siempre false.
        hovered && !isInactive ? { backgroundColor: HOVER_BG[variant] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vr.label.color as string} size="small" />
      ) : (
        <>
          {leftIcon ? <Text style={[sz.label, vr.label]}>{leftIcon}</Text> : null}
          <Text style={[sz.label, vr.label]}>{children}</Text>
          {rightIcon ? <Text style={[sz.label, vr.label]}>{rightIcon}</Text> : null}
        </>
      )}
    </Pressable>
  );
}
