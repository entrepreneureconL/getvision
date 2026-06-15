/**
 * <Tooltip /> — burbuja de datos en hover (primitivo #15 del DS, D-20.a).
 *
 * Web-only por diseño: en native el tap ya muestra el dato (el filtro del
 * calendario, el detalle abajo), así que el tooltip es SIEMPRE una mejora,
 * nunca el único camino al dato (spec §4.8 + §4.7). En native retorna null.
 *
 * Presentacional y controlado: el PADRE maneja el hover (con `useHover`) y la
 * visibilidad. Esto evita anidar Pressables (la celda del calendario y la
 * columna de PeriodBars ya tienen su propio contenedor) y deja que el padre
 * monte la burbuja DONDE controla el recorte — clave por LESSONS #8: si el
 * contenedor tiene `overflow: 'hidden'` (PeriodBars) la burbuja debe montarse
 * fuera de esa zona. El padre debe ser `position: 'relative'` (default en RN).
 *
 * Uso:
 *   const { hovered, hoverHandlers } = useHover({ delay: 250 });
 *   <View>                          // position relative por default
 *     <Pressable {...hoverHandlers}>…</Pressable>
 *     <Tooltip visible={hovered} label="↑ $12.500 · ↓ $3.200 · 4 mov" />
 *   </View>
 */

import { View, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { color, radius, space, shadow } from '../tokens';
import DSText from './Text';

type Placement = 'top' | 'bottom';

type Props = {
  /** Lo controla el padre (típicamente `hovered` de useHover con delay). */
  visible: boolean;
  /** Texto de la burbuja (1 línea: "↑ $X · ↓ $Y · N mov"). */
  label: string;
  /** Arriba (default) o abajo del ancla. */
  placement?: Placement;
  style?: StyleProp<ViewStyle>;
};

export default function Tooltip({ visible, label, placement = 'top', style }: Props) {
  // Native: el dato vive en el tap; el tooltip no aplica (paridad limpia).
  if (Platform.OS !== 'web' || !visible) return null;

  const positional: ViewStyle =
    placement === 'top'
      ? { bottom: '100%', marginBottom: space['1'] }
      : { top: '100%', marginTop: space['1'] };

  return (
    <View
      // No intercepta el mouse: el hover sigue siendo del ancla de abajo.
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          backgroundColor: color.bg.elevated,
          borderRadius: radius.md,
          paddingVertical: space['1'],
          paddingHorizontal: space['2'],
          zIndex: 50,
        },
        shadow.raised,
        positional,
        style,
      ]}
    >
      <DSText variant="micro" color="primary">
        {label}
      </DSText>
    </View>
  );
}
