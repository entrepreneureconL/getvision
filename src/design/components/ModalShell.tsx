/**
 * <ModalShell /> — caparazón unificado de modales (primitivo #16 del DS, D-20.b).
 *
 * Unifica la dinámica de TODOS los diálogos de la app, que hoy es inconsistente
 * (spec §4.8.b): QuickProduct/QuickHours cierran con clic en el backdrop, pero
 * Sale/Cost/MovementForm (donde vive el flujo "Cobrar") no — su overlay es un
 * `View` plano y el clic afuera es un no-op mudo. Esta pieza centraliza:
 *
 *   1. Overlay + backdrop oscuro presionable (clic afuera → cierra).
 *   2. Esc en web (misma regla que el backdrop).
 *   3. Back de Android (`onRequestClose` del Modal).
 *   4. Protocolo dirty: si el form tiene cambios sin guardar, el cierre por
 *      backdrop/Esc/back NO descarta en silencio — dispara `confirmDestructive`
 *      ("¿Descartar los cambios?"). El × / Cancelar del form siguen llamando
 *      onClose directo (cierre explícito del usuario, sin re-preguntar).
 *
 * Regla §4.8.b: nunca se pierde input por un clic accidental; nunca se retiene
 * al usuario en un form vacío (dirty=false cierra directo).
 *
 * El form SOLO aporta su contenido (su panel) como `children`. La posición la
 * decide `placement`: 'sheet' (bottom, default — los forms de carga) o 'center'
 * (diálogos centrados). El backdrop va DETRÁS del panel (Pressable absoluto),
 * así un tap en el panel no burbujea al backdrop (sin anidar Pressables, sin
 * cursor pointer espurio en el panel).
 *
 * Uso:
 *   <ModalShell visible={open} onClose={close} dirty={isDirty}>
 *     <View style={styles.panel}>… el form …</View>
 *   </ModalShell>
 */

import { useEffect, useRef, type ReactNode } from 'react';
import {
  Modal,
  View,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { color } from '../tokens';
import { confirmDestructive } from '../../utils/confirm';

type Placement = 'sheet' | 'center';

type Props = {
  visible: boolean;
  /** Cierre real (el padre desmonta / setea su estado). */
  onClose: () => void;
  /** true = hay cambios sin guardar → backdrop/Esc/back piden confirmación. */
  dirty?: boolean;
  /** 'sheet' (bottom sheet, default) | 'center' (diálogo centrado). */
  placement?: Placement;
  /** Copys del confirm dirty (defaults razonables). */
  dirtyTitle?: string;
  dirtyMessage?: string;
  children: ReactNode;
  /** animationType del Modal. Default según placement (sheet→slide, center→fade). */
  animationType?: 'none' | 'slide' | 'fade';
  /** true = envuelve en KeyboardAvoidingView (el teclado empuja el sheet hacia
   *  arriba). Para forms con inputs cerca del borde inferior (Quick*). Default
   *  false: los forms con ScrollView + footer fijo no lo necesitan. */
  avoidKeyboard?: boolean;
};

export default function ModalShell({
  visible,
  onClose,
  dirty = false,
  placement = 'sheet',
  dirtyTitle = '¿Descartar los cambios?',
  dirtyMessage = 'Si salís ahora se pierde lo que cargaste.',
  children,
  animationType,
  avoidKeyboard = false,
}: Props) {
  // Cierre por backdrop/Esc/back: si está dirty, confirmar antes de descartar.
  const requestClose = () => {
    if (dirty) {
      confirmDestructive({
        title: dirtyTitle,
        message: dirtyMessage,
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        onConfirm: onClose,
      });
    } else {
      onClose();
    }
  };

  // Ref con el último requestClose para no re-bindear el listener cada render.
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  // Esc en web cierra (misma regla que el backdrop). Native: no aplica (back).
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const anim = animationType ?? (placement === 'sheet' ? 'slide' : 'fade');
  const rootStyle = placement === 'sheet' ? styles.sheetRoot : styles.centerRoot;

  const inner = (
    <>
      {/* Backdrop oscuro DETRÁS del panel — clic afuera cierra. */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: color.bg.overlay }]}
        onPress={requestClose}
      />
      {children}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType={anim} onRequestClose={requestClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={rootStyle}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        <View style={rootStyle}>{inner}</View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  centerRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});

export type { Props as ModalShellProps };
