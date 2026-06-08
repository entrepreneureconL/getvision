/**
 * <Heading /> — títulos jerárquicos.
 *
 * Reemplazo de los `<Text style={{ fontSize: 24, fontWeight: 'bold' }}>` que
 * aparecen sueltos en cada pantalla. Una sola fuente para tamaños y pesos.
 *
 * Niveles (mapeados a tokens.text.size):
 *   display → hero metric (44px, weight bold, tracking tight)
 *   1       → título de pantalla (28px, semibold)
 *   2       → sección grande (24px, semibold)
 *   3       → subsección (20px, semibold)
 *   4       → título de card (17px, semibold)
 *
 * Por qué `level` y no `as`: en RN no hay tags HTML. El `level` solo afecta
 * el estilo, no el árbol del DOM. Mucho más simple que h1-h6.
 *
 * Uso:
 *   <Heading level={1}>Mi Negocio</Heading>
 *   <Heading level="display" color="accent">$ 109.700</Heading>
 *   <Heading level={3} numberOfLines={1}>Últimos movimientos</Heading>
 */

import { Text, type TextStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import { color as tokenColor, text as tokenText } from '../tokens';

type Level = 'display' | 1 | 2 | 3 | 4;
type ColorVariant = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'danger' | 'warning';

type Props = {
  level: Level;
  children: ReactNode;
  /** Color semántico. Default: primary. */
  color?: ColorVariant;
  /** Override de align (default: left, hereda del padre). */
  align?: 'left' | 'center' | 'right';
  /** Trunca a N líneas con "...". */
  numberOfLines?: number;
  /** Estilo extra para casos puntuales (evitar abuso). */
  style?: StyleProp<TextStyle>;
};

/** Mapa de nivel a (size, weight, letterSpacing). */
const LEVEL_STYLES: Record<Level, TextStyle> = {
  display: {
    fontSize: tokenText.size['5xl'],
    lineHeight: tokenText.lineHeight['5xl'],
    fontWeight: tokenText.weight.bold as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.tighter,
  },
  1: {
    fontSize: tokenText.size['3xl'],
    lineHeight: tokenText.lineHeight['3xl'],
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.tight,
  },
  2: {
    fontSize: tokenText.size['2xl'],
    lineHeight: tokenText.lineHeight['2xl'],
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.tight,
  },
  3: {
    fontSize: tokenText.size.xl,
    lineHeight: tokenText.lineHeight.xl,
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.normal,
  },
  4: {
    fontSize: tokenText.size.lg,
    lineHeight: tokenText.lineHeight.lg,
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.normal,
  },
};

/** Mapa de variante semántica a hex de paleta. */
const COLOR_MAP: Record<ColorVariant, string> = {
  primary: tokenColor.text.primary,
  secondary: tokenColor.text.secondary,
  tertiary: tokenColor.text.tertiary,
  accent: tokenColor.accent.base,
  success: tokenColor.success.base,
  danger: tokenColor.danger.base,
  warning: tokenColor.warning.base,
};

export default function Heading({
  level,
  children,
  color: colorVariant = 'primary',
  align,
  numberOfLines,
  style,
}: Props) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        LEVEL_STYLES[level],
        { color: COLOR_MAP[colorVariant] },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
