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
import { Modal, Platform, StyleSheet, View } from 'react-native';
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

  // Contenido del diálogo (idéntico en web y native).
  const dialog = pending && (
    <Card variant="elevated" padding="xl" rounded="xl" style={styles.card}>
      <Stack gap="4">
        <Heading level={3} color="primary">{pending.title}</Heading>
        <Text variant="body" color="secondary">{pending.message}</Text>
        <Stack direction="row" gap="3" style={{ marginTop: space['2'] }}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" size="md" fullWidth onPress={() => close('cancel')}>
              {pending.cancelLabel ?? 'Cancelar'}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="danger" size="md" fullWidth onPress={() => close('confirm')}>
              {pending.confirmLabel ?? 'Eliminar'}
            </Button>
          </View>
        </Stack>
      </Stack>
    </Card>
  );

  return (
    <>
      {children}

      {/*
        P-022: en WEB NO usamos un segundo <Modal> de RN. Cuando este confirm se
        dispara desde el backdrop de un form que YA tiene un <Modal> abierto,
        react-native-web queda con dos Modals apilados → el confirm no recibe
        eventos / la pantalla se congela. En su lugar montamos un overlay fixed
        de nivel superior (position:'fixed' + zIndex alto) que pinta SOBRE el
        Modal del form y sí es interactivo. En native seguimos con <Modal>
        (el anidamiento nativo funciona bien y respeta el back de Android).
       */}
      {Platform.OS === 'web' ? (
        pending != null ? (
          <View style={[styles.backdrop, styles.webFixed]}>{dialog}</View>
        ) : null
      ) : (
        <Modal
          visible={pending != null}
          transparent
          animationType="fade"
          onRequestClose={() => close('cancel')}
        >
          <View style={styles.backdrop}>{dialog}</View>
        </Modal>
      )}
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
  // Web only: overlay fixed que cubre el viewport por encima de cualquier Modal
  // de form (P-022). `position:'fixed'` es válido en react-native-web aunque el
  // typing de RN no lo incluya → cast. `flex:1` no aplica sin padre flex, por
  // eso fijamos las 4 esquinas.
  webFixed: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
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
