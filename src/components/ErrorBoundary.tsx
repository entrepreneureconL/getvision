/**
 * <ErrorBoundary /> — atrapa errores no manejados durante el render.
 *
 * Sin esto: cualquier excepción en cualquier componente desmonta toda la app
 * y el usuario ve pantalla blanca sin saber qué pasó.
 *
 * Con esto: la app muestra una pantalla amigable con un botón "Reintentar"
 * que resetea el boundary (re-monta los children). Si el error era transitorio
 * (e.g. fetch que falló), la app vuelve a funcionar al apretar reintentar.
 *
 * IMPORTANTE: solo atrapa errores que ocurren DURANTE el render o en
 * lifecycle methods de componentes. NO atrapa errores en:
 *   - Event handlers (esos los maneja try/catch normal).
 *   - Código async (esos también, con try/catch).
 *   - El error boundary mismo.
 *
 * Analogía: como un std::set_terminate() global en C++ pero por sub-árbol.
 *           No existe equivalente directo en Python (excepción que no se
 *           captura termina el proceso).
 *
 * Por qué class component: los hooks (useState, useEffect) NO pueden
 * implementar componentDidCatch ni getDerivedStateFromError. React no expuso
 * esa API a hooks todavía. Es la única razón aceptada para usar class
 * components en el código moderno.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

type Props = {
  children: ReactNode;
  /** Fallback custom; si no se provee, usamos la UI default. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  /**
   * React llama esto cuando un descendiente tira error durante render.
   * Devolvemos el nuevo state que pone hasError=true.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Para logging (Sentry/PostHog en Fase 1). Por ahora console.error.
   */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Atrapó error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    // TODO Fase 1: enviar a Sentry / PostHog.
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Fallback custom si lo pasó el caller
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Fallback default — sobrio, en español rioplatense, no técnico.
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.emoji}>🛠</Text>
            <Text style={styles.title}>Algo salió mal</Text>
            <Text style={styles.subtitle}>
              Tuvimos un problema cargando esta pantalla. No perdiste nada de tu información.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={this.reset}
              activeOpacity={0.75}
            >
              <Text style={styles.buttonText}>Reintentar</Text>
            </TouchableOpacity>

            {/* Detalles solo visibles en dev — útil para debuggear */}
            {__DEV__ && (
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>Detalle (dev):</Text>
                <Text style={styles.devText} numberOfLines={6}>
                  {this.state.error.message}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#7F8C8D',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 320,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2E86C1',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  devBox: {
    marginTop: 32,
    padding: 14,
    backgroundColor: '#141422',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C1C30',
    maxWidth: 360,
  },
  devTitle: {
    color: '#E67E22',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  devText: {
    color: '#7F8C8D',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
