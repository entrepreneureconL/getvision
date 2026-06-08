/**
 * <Divider /> — línea divisoria horizontal o vertical.
 *
 * Usar con moderación. En el lenguaje iPhone Screen Time, los dividers son
 * casi invisibles (border.subtle) y aparecen dentro de cards densas (lista
 * "Most Used"), no entre cards distintas.
 *
 * Uso:
 *   <Card padding="lg">
 *     <Heading level={4}>Daily Average</Heading>
 *     <Heading level="display">5h 9m</Heading>
 *     <Divider spacing="3" />
 *     <Heading level={4}>Notifications</Heading>
 *     ...
 *   </Card>
 *
 *   <Stack direction="row" align="center">
 *     <Text>Foo</Text>
 *     <Divider orientation="vertical" />
 *     <Text>Bar</Text>
 *   </Stack>
 */

import { View } from 'react-native';
import { color, space, type SpaceKey } from '../tokens';

type Orientation = 'horizontal' | 'vertical';
type Variant = 'subtle' | 'default';

type Props = {
  orientation?: Orientation;
  variant?: Variant;
  /** Margen vertical (horizontal) o horizontal (vertical). Default: '0'. */
  spacing?: SpaceKey;
};

const VARIANT_COLOR: Record<Variant, string> = {
  subtle: color.border.subtle,
  default: color.border.default,
};

export default function Divider({
  orientation = 'horizontal',
  variant = 'subtle',
  spacing = '0',
}: Props) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={{
        backgroundColor: VARIANT_COLOR[variant],
        height: isHorizontal ? 1 : '100%',
        width: isHorizontal ? '100%' : 1,
        marginVertical: isHorizontal ? space[spacing] : 0,
        marginHorizontal: isHorizontal ? 0 : space[spacing],
      }}
    />
  );
}
