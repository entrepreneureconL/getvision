/**
 * WelcomeScreen — primera pantalla. Punto único de entrada (signup + login en
 * la siguiente, decidido en F0-6).
 *
 * F1-D: refactor a Design System. Antes eran StyleSheet inline con hex pelados
 * y fuente 52/22/15. Ahora todo viene de tokens vía primitivos.
 */

import { View } from 'react-native';
import { Heading, Text, Stack, Button, color, space } from '../design';
import Container from '../components/Container';

export default function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg.base,
        paddingHorizontal: space['8'],
      }}
    >
      <Container style={{ flex: 1 }}>
        <Stack
          flex
          gap="6"
          align="center"
          justify="center"
        >
          {/* Logo "GetVision" — dos colores. Heading no soporta split color,
              así que combinamos dos Heading display en row. */}
          <Stack direction="row" gap="0" align="baseline">
            <Heading level="display">Get</Heading>
            <Heading level="display" color="accent">Vision</Heading>
          </Stack>

          {/* Ícono decorativo. Futuro: SVG con marca. */}
          <Text variant="body" align="center" style={{ fontSize: 64, lineHeight: 72 }}>
            📊
          </Text>

          {/* Tagline + subtítulo */}
          <Stack gap="3" align="center">
            <Heading level={1} align="center">
              Tu negocio, bajo control
            </Heading>
            <Text variant="body" color="secondary" align="center">
              Gestioná tus ventas, costos y resultados{'\n'}
              de forma simple y visual.
            </Text>
          </Stack>

          {/* CTA — el único entry point. LoginScreen tiene el toggle. */}
          <Stack gap="3" style={{ width: '100%', maxWidth: 400 }} align="center">
            <Button variant="primary" size="lg" fullWidth onPress={onStart}>
              Comenzar gratis  →
            </Button>
            <Text variant="caption" color="tertiary" align="center">
              Si ya tenés cuenta, también ingresás desde acá.
            </Text>
          </Stack>
        </Stack>
      </Container>
    </View>
  );
}
