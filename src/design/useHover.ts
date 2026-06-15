/**
 * useHover — estado de hover para la capa de micro-interacciones (D-20.a).
 *
 * RN-web dispara `onHoverIn`/`onHoverOut` en `Pressable`; native NO los dispara
 * (degradación limpia, cero riesgo de paridad — LESSONS #1). Este hook
 * encapsula el estado + un delay opcional para los tooltips (250ms, spec §4.8).
 *
 * Por qué un hook y no `style={({ hovered }) => …}`: el tipo
 * `PressableStateCallbackType` de react-native solo declara `pressed`
 * (`hovered`/`focused` son extensiones de RN-web sin tipar) — usarlos ahí daría
 * error de TS. Con `onHoverIn`/`onHoverOut` (sí tipados en PressableProps) el
 * estado es explícito y type-safe.
 *
 * Uso:
 *   const { hovered, hoverHandlers } = useHover();
 *   <Pressable {...hoverHandlers} style={[base, hovered && hoverStyle]} />
 *
 *   // con delay para tooltip:
 *   const { hovered, hoverHandlers } = useHover({ delay: 250 });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  /** ms antes de marcar `hovered` (para tooltips). Default 0 = inmediato. */
  delay?: number;
};

export function useHover(options?: Options) {
  const delay = options?.delay ?? 0;
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onHoverIn = useCallback(() => {
    if (delay > 0) {
      clear();
      timer.current = setTimeout(() => setHovered(true), delay);
    } else {
      setHovered(true);
    }
  }, [delay, clear]);

  const onHoverOut = useCallback(() => {
    clear();
    setHovered(false);
  }, [clear]);

  // Limpiar el timer pendiente al desmontar (evita setState sobre desmontado).
  useEffect(() => clear, [clear]);

  return { hovered, hoverHandlers: { onHoverIn, onHoverOut } };
}
