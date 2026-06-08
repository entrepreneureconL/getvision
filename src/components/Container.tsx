/**
 * <Container /> — wrapper que limita el ancho del contenido y lo centra.
 *
 * Problema que resuelve: React Native Web sin maxWidth estira todo el layout
 * al ancho del viewport. En desktop (~1920px) eso destroza proporciones que
 * estaban pensadas para mobile (375-414px).
 *
 * Solución: maxWidth + alignSelf 'center'. En mobile no afecta (el viewport
 * ya es < maxWidth). En desktop centra y conserva proporciones legibles.
 *
 * Analogía web: como `max-width: 640px; margin: 0 auto` en CSS.
 *
 * Uso típico:
 *   <SafeAreaView>
 *     <ScrollView>
 *       <Container>
 *         ...todo el contenido va acá adentro...
 *       </Container>
 *     </ScrollView>
 *   </SafeAreaView>
 */

import { View, type ViewStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';

/** Ancho máximo del contenido. 640px = tablet vertical / lectura cómoda. */
export const DEFAULT_MAX_WIDTH = 640;

type Props = {
  children: ReactNode;
  /** Override del max width default. */
  maxWidth?: number;
  /** Estilo extra para el contenedor. */
  style?: StyleProp<ViewStyle>;
};

export default function Container({
  children,
  maxWidth = DEFAULT_MAX_WIDTH,
  style,
}: Props) {
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
