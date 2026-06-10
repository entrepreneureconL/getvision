/**
 * ConfirmProvider — modal de confirmación con look del Design System.
 *
 * Por qué existe:
 *   Hasta ahora `confirmDestructive` usaba `window.confirm` en web y
 *   `Alert.alert` en native. Los dos rompen la estética dark + teal de la app:
 *   el del browser usa colores del SO y el Alert nativo de iOS/Android tampoco
 *   matchea con el resto. Este Provider monta un modal custom una sola vez en
 *   la raíz de la app y queda a la espera de pedidos.
 *
 * Cómo se usa:
 *   1) Envolver el árbol con <ConfirmProvider>...</ConfirmProvider> en App.tsx
 *      (una sola vez).
 *   2) Desde cualquier handler: `confirmDestructive({ title, message, onConfirm })`
 *      — la firma no cambió, todos los call sites siguen igual.
 *
 * Cómo conecta el helper imperativo con el componente:
 *   Singleton `setConfirmHandler(fn)`. El Provider registra su `open` al
 *   montarse y lo deregistra al desmontarse. `confirmDestructive` consulta
 *   ese singleton — si hay handler, abre el modal; si no, fallback al
 *   confirm nativo (defensa por si alguien usa `confirm` antes de que el
 *   Provider termine de montar).
 *
 * Filosofía:
 *   Mantener la API imperativa es importante porque los handlers ya están
 *   escritos así. Cambiar todo a hook (`const confirm = useConfirm()`) sería
 *   más React-idiomático pero un refactor inútil para esta vuelta.
 */

import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  Card, Heading, Text, Stack, Button, color, space, radius,
} from '../design';
import { setConfirmHandler, type ConfirmOptions } from '../utils/confirm';

type PendingConfirm = ConfirmOptions & {
  /** Se setea internamente para distinguir cada confirm (idempotente al cerrar). */
  _id: number;
};

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    // Registramos el handler imperativo al montar.
    setConfirmHandler((opts) => {
      idRef.current += 1;
      setPending({ ...opts, _id: idRef.current });
    });
    // Al desmontar, restauramos null para que `confirm.ts` use el fallback.
    return () => setConfirmHandler(null);
  }, []);

  const close = (which: 'confirm' | 'cancel') => {
    if (!pending) return;
    const { onConfirm, onCancel } = pending;
    setPending(null);
    // Disparamos el callback DESPUÉS del setState para que el modal se cierre
    // primero y el callback no vea el modal montado (importante si el callback
    // abre OTRO confirm — caso poco común pero defensivo).
    if (which === 'confirm') onConfirm();
    else if (onCancel) onCancel();
  };

  return (
    <>
      {children}

      {/*
        Modal de RN: backdrop dimmed + content centered. transparent=true para
        que el backdrop se vea (View con bg semi-transparente).
        animationType="fade": consistente con AddCategoryModal pero más rápido
        que slide.
       */}
      <Modal
        visible={pending != null}
        transparent
        animationType="fade"
        onRequestClose={() => close('cancel')}
      >
        <View style={styles.backdrop}>
          <Card variant="elevated" padding="xl" rounded="xl" style={styles.card}>
            {pending && (
              <Stack gap="4">
                <Heading level={3} color="primary">{pending.title}</Heading>
                <Text variant="body" color="secondary">{pending.message}</Text>
                <Stack direction="row" gap="3" style={{ marginTop: space['2'] }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="ghost"
                      size="md"
                      fullWidth
                      onPress={() => close('cancel')}
                    >
                      {pending.cancelLabel ?? 'Cancelar'}
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="danger"
                      size="md"
                      fullWidth
                      onPress={() => close('confirm')}
                    >
                      {pending.confirmLabel ?? 'Eliminar'}
                    </Button>
                  </View>
                </Stack>
              </Stack>
            )}
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['5'],
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.bg.raised,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.xl,
  },
});
