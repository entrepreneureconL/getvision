/**
 * <Stack /> — layout primitivo basado en flex + gap.
 *
 * Reemplaza el patrón `<View style={{ flexDirection: 'column', gap: 12 }}>` que
 * se repite en cada pantalla. Reduce ruido visual y centraliza la decisión de
 * cuánto separar los hijos.
 *
 * Equivalente CSS:
 *   .stack { display: flex; flex-direction: column; gap: 12px; }
 *
 * Equivalente Tamagui/Chakra: `<VStack gap="$3">` / `<HStack>`.
 *
 * Diferencias clave:
 *   - `direction="row"` para horizontal, `"column"` para vertical.
 *   - `gap` toma keys del token de spacing (1, 2, 3, 4, 6...). No números.
 *   - `align` / `justify` mapean directo a alignItems / justifyContent.
 *
 * Uso:
 *   <Stack gap="4">
 *     <HeroMetricCard ... />
 *     <TransactionList ... />
 *   </Stack>
 *
 *   <Stack direction="row" gap="2" align="center" justify="space-between">
 *     <Heading level={3}>Movimientos</Heading>
 *     <Button variant="ghost" size="sm">Ver todos</Button>
 *   </Stack>
 */

import { View, type ViewStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import { space, type SpaceKey } from '../tokens';

type Direction = 'row' | 'column';
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';

type Props = {
  children: ReactNode;
  /** Default: column. */
  direction?: Direction;
  /** Espaciado entre hijos. Default: '2' (8px). */
  gap?: SpaceKey;
  align?: Align;
  justify?: Justify;
  /** Si true, hace `flexWrap: 'wrap'` (útil en grids de chips). */
  wrap?: boolean;
  /** Toma todo el alto disponible. */
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
};

const ALIGN_MAP: Record<Align, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY_MAP: Record<Justify, ViewStyle['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
};

export default function Stack({
  children,
  direction = 'column',
  gap = '2',
  align,
  justify,
  wrap = false,
  flex = false,
  style,
}: Props) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: space[gap],
          flexWrap: wrap ? 'wrap' : 'nowrap',
          flex: flex ? 1 : undefined,
        },
        align ? { alignItems: ALIGN_MAP[align] } : null,
        justify ? { justifyContent: JUSTIFY_MAP[justify] } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
