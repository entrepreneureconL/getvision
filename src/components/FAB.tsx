/**
 * <FAB /> — Floating Action Button estilo Material Design.
 *
 * Botón circular fijo en esquina inferior derecha. Acceso rápido a la acción
 * primaria sin importar dónde esté el usuario en el scroll.
 *
 * Nota técnica importante: para que el FAB quede en la esquina del viewport
 * (y no del Container con maxWidth), debe montarse FUERA del Container,
 * dentro del SafeAreaView que ocupa todo el ancho. position: 'absolute' se
 * resuelve relativo al padre con position relative (o el root layout).
 *
 * En web: position: 'absolute' dentro del SafeAreaView ya funciona porque
 * el SafeAreaView toma todo el viewport.
 *
 * Diseño:
 *   - 60×60 (touch target cómodo según WCAG: mínimo 44×44).
 *   - Círculo perfecto (borderRadius = width/2).
 *   - Shadow para destacarlo sobre el contenido del scroll.
 *   - Color: teal de marca (D-3 — antes azul legacy #2E86C1, pre-ADR #11).
 */

import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { color as token } from '../design';

type Props = {
  onPress: () => void;
  /** Ícono o texto del botón. Default "+". */
  label?: string;
  /** Color de fondo. Default azul primario. */
  color?: string;
  /** Posición desde el borde derecho. Default 24. */
  right?: number;
  /** Posición desde el borde inferior. Default 24. */
  bottom?: number;
  /** Tamaño del botón. Default 60. */
  size?: number;
};

export default function FAB({
  onPress,
  label = '+',
  color = token.accent.base,
  right = 24,
  bottom = 24,
  size = 60,
}: Props) {
  return (
    <View
      style={[
        styles.wrapper,
        {
          right,
          bottom,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      // pointerEvents box-none evita que el wrapper bloquee taps fuera del botón
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: color,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.label, { fontSize: size * 0.45 }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    // Shadow para destacar sobre el contenido.
    // En iOS: shadowColor / shadowOpacity / shadowOffset / shadowRadius.
    // En Android: elevation.
    // RN Web usa boxShadow; con estas props lo emula bien.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: undefined,
    // En RN web a veces el "+" queda mal centrado verticalmente.
    // marginTop chico compensa.
    marginTop: -2,
  },
});
