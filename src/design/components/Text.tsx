/**
 * <Text /> (de diseño) — texto de cuerpo, caption y micro.
 *
 * Cuidado: el `Text` de react-native tiene el mismo nombre. Por eso este
 * archivo exporta `default` y conviene importarlo con alias:
 *   import DSText from '@/design/components/Text';
 * O directamente desde el barrel `@/design`.
 *
 * Variantes (mapeo a tokens.text.size):
 *   body        → md (15) regular
 *   bodyStrong  → md (15) semibold
 *   caption     → sm (13) regular — hints, sub-info de card
 *   captionStrong → sm (13) semibold — labels
 *   micro       → xs (11) medium uppercase tracking wide — timestamps, badges
 *
 * Uso:
 *   <DSText>Este mes vendiste $ 480.000.</DSText>
 *   <DSText variant="caption" color="tertiary">Actualizado hace 3 min</DSText>
 *   <DSText variant="micro" color="secondary">TU HORA RINDE</DSText>
 */

import { Text as RNText, type TextStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import { color as tokenColor, text as tokenText } from '../tokens';

type Variant = 'body' | 'bodyStrong' | 'caption' | 'captionStrong' | 'micro';
type ColorVariant = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'success' | 'danger' | 'warning';

type Props = {
  children: ReactNode;
  variant?: Variant;
  color?: ColorVariant;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  /** Si true, aplica `textTransform: 'uppercase'` (útil para micro labels). */
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
};

const VARIANT_STYLES: Record<Variant, TextStyle> = {
  body: {
    fontSize: tokenText.size.md,
    lineHeight: tokenText.lineHeight.md,
    fontWeight: tokenText.weight.regular as TextStyle['fontWeight'],
  },
  bodyStrong: {
    fontSize: tokenText.size.md,
    lineHeight: tokenText.lineHeight.md,
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
  },
  caption: {
    fontSize: tokenText.size.sm,
    lineHeight: tokenText.lineHeight.sm,
    fontWeight: tokenText.weight.regular as TextStyle['fontWeight'],
  },
  captionStrong: {
    fontSize: tokenText.size.sm,
    lineHeight: tokenText.lineHeight.sm,
    fontWeight: tokenText.weight.semibold as TextStyle['fontWeight'],
  },
  micro: {
    fontSize: tokenText.size.xs,
    lineHeight: tokenText.lineHeight.xs,
    fontWeight: tokenText.weight.medium as TextStyle['fontWeight'],
    letterSpacing: tokenText.letterSpacing.wide,
  },
};

const COLOR_MAP: Record<ColorVariant, string> = {
  primary: tokenColor.text.primary,
  secondary: tokenColor.text.secondary,
  tertiary: tokenColor.text.tertiary,
  disabled: tokenColor.text.disabled,
  accent: tokenColor.accent.base,
  success: tokenColor.success.base,
  danger: tokenColor.danger.base,
  warning: tokenColor.warning.base,
};

export default function Text({
  children,
  variant = 'body',
  color: colorVariant = 'primary',
  align,
  numberOfLines,
  uppercase = false,
  style,
}: Props) {
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        VARIANT_STYLES[variant],
        { color: COLOR_MAP[colorVariant] },
        align ? { textAlign: align } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
