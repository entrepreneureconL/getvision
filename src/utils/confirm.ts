/**
 * confirm.ts — helper de confirmación cross-platform.
 *
 * Estrategia (3 niveles, en orden de preferencia):
 *
 *   1. Modal custom del Design System — si `ConfirmProvider` está montado en
 *      la raíz, registra un handler vía `setConfirmHandler`. Esa es la ruta
 *      principal: mantiene la estética dark + teal de la app y permite
 *      tipografía/spacing consistentes.
 *
 *   2. window.confirm / window.alert — si estamos en web y el Provider NO
 *      está montado (caso raro: bootstrap antes de que el Provider termine).
 *
 *   3. Alert.alert nativo de iOS/Android — última opción. Funciona pero rompe
 *      la estética. En la práctica solo se usaría como fallback si alguien
 *      arrancara la app sin envolver con el Provider.
 *
 * Por qué la API es imperativa (no hook):
 *   Todos los call sites ya estaban escritos con la firma imperativa
 *   (`confirmDestructive({ title, message, onConfirm })`). Migrar a hook
 *   requeriría tocar cada uno. Para esta vuelta priorizamos no romper.
 *   Si en F2 unificamos, este archivo es el único cambio.
 */

import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;   // texto del botón destructivo (default: "Eliminar")
  cancelLabel?: string;    // texto del botón cancelar (default: "Cancelar")
  onConfirm: () => void;
  onCancel?: () => void;
};

// ────────────────────────────────────────────────────────────────────
// Bridge con ConfirmProvider — singleton mutable
// ────────────────────────────────────────────────────────────────────

type ConfirmHandler = (opts: ConfirmOptions) => void;
let activeHandler: ConfirmHandler | null = null;

/**
 * Lo invoca `ConfirmProvider` al montar (registrar) y desmontar (clear).
 * No exportar como API "pública" — solo el Provider debe usarlo.
 */
export function setConfirmHandler(handler: ConfirmHandler | null): void {
  activeHandler = handler;
}

// ────────────────────────────────────────────────────────────────────
// API pública
// ────────────────────────────────────────────────────────────────────

export function confirmDestructive(opts: ConfirmOptions): void {
  // 1. Si el Provider está montado, ruta principal — modal del DS.
  if (activeHandler) {
    activeHandler(opts);
    return;
  }

  const {
    title, message, confirmLabel = 'Eliminar', cancelLabel = 'Cancelar',
    onConfirm, onCancel,
  } = opts;

  // 2. Fallback web — window.confirm.
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined'
      ? window.confirm(`${title}\n\n${message}`)
      : false;
    if (ok) onConfirm();
    else if (onCancel) onCancel();
    return;
  }

  // 3. Fallback native — Alert.alert.
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Alerta informativa de una sola vía (sin confirmación). Útil para errores
 * que el usuario debe ver pero no necesitan ack distinto a "OK".
 *
 * F2: hoy usa window.alert/Alert.alert. Podríamos unificar al modal del DS
 * (con un solo botón) reusando el Provider, pero por ahora simple.
 */
export function alertInfo(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message, [{ text: 'OK' }]);
}
