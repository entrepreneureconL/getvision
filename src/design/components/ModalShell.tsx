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
 *      backdrop/Esc/back/× NO descarta en silencio — muestra "¿Descartar los
 *      cambios?" (Seguir editando / Descartar).
 *
 * P-022 (2026-09-22): el confirm de descarte se renderiza DENTRO del propio
 * Modal de ModalShell (overlay absoluto sobre el panel), NO como un segundo
 * <Modal> de react-native-web. Dos Modals RN-web apilados se pisan (el 2º queda
 * detrás del portal del 1º → congela / no se puede cerrar). Con un solo Modal el
 * stacking es determinístico. El × del form dispara el MISMO flujo vía el context
 * `useModalShellClose()` — así × y clic-afuera se comportan idéntico.
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
 *
 * En el header del form, el × usa el context en vez de onClose directo:
 *   const requestClose = useModalShellClose();
 *   <TouchableOpacity onPress={requestClose}>✕</TouchableOpacity>
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { color, space, radius } from '../tokens';

type Placement = 'sheet' | 'center';

/**
 * Handle imperativo de ModalShell. El × del header del form lo usa vía ref para
 * disparar el MISMO flujo de cierre que el backdrop/Esc/back (P-022) — así ×,
 * clic-afuera y Esc muestran el confirm de descarte del mismo modo.
 *
 *   const shellRef = useRef<ModalShellHandle>(null);
 *   <ModalShell ref={shellRef} …>
 *     <TouchableOpacity onPress={() => shellRef.current?.requestClose()}>✕…
 */
export type ModalShellHandle = { requestClose: () => void };

type Props = {
  visible: boolean;
  /** Cierre real (el padre desmonta / setea su estado). */
  onClose: () => void;
  /** true = hay cambios sin guardar → backdrop/Esc/back/× piden confirmación. */
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

const ModalShell = forwardRef<ModalShellHandle, Props>(function ModalShell({
  visible,
  onClose,
  dirty = false,
  placement = 'sheet',
  dirtyTitle = '¿Descartar los cambios?',
  dirtyMessage = 'Si salís ahora se pierde lo que cargaste.',
  children,
  animationType,
  avoidKeyboard = false,
}: Props, ref) {
  // Confirm de descarte in-Modal (P-022): visible cuando el usuario intenta
  // cerrar un form con cambios. NO es otro <Modal>, es un overlay dentro de este.
  const [confirming, setConfirming] = useState(false);

  // Al ocultarse el shell, resetear el confirm (evita quedar "pegado" si el
  // padre reabre el mismo modal).
  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  // Cierre por backdrop/Esc/back/×: si está dirty, mostrar el confirm; si no,
  // cerrar directo. Si el confirm ya está abierto, Esc/back lo cancelan.
  const requestClose = () => {
    if (confirming) {
      setConfirming(false);
      return;
    }
    if (dirty) setConfirming(true);
    else onClose();
  };

  // Ref con el último requestClose para no re-bindear el listener cada render
  // ni el handle imperativo.
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  // El × del form dispara el mismo flujo vía ref (P-022).
  useImperativeHandle(ref, () => ({ requestClose: () => closeRef.current() }), []);

  // Esc en web (misma regla que el backdrop). Native: no aplica (back).
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

  // P-021: en 'sheet', el panel se limita a maxWidth 640 y se centra. Sin esto,
  // en escritorio el sheet ocupa TODO el ancho (flex-end + stretch) y el único
  // backdrop clickeable es una franja fina arriba. Con el cap, quedan bandas de
  // backdrop a los costados que sí cierran. En móvil (<640) es 100%.
  const panelWrap =
    placement === 'sheet' ? <View style={styles.sheetPanelWrap}>{children}</View> : children;

  const inner = (
    <>
      {/* Backdrop oscuro DETRÁS del panel — clic afuera cierra. */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: color.bg.overlay }]}
        onPress={requestClose}
      />
      {panelWrap}

      {/* Confirm de descarte — overlay DENTRO de este Modal (no un 2º Modal). */}
      {confirming ? (
        <View style={styles.confirmRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.confirmScrim]}
            onPress={() => setConfirming(false)}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{dirtyTitle}</Text>
            <Text style={styles.confirmMsg}>{dirtyMessage}</Text>
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnGhost]}
                onPress={() => setConfirming(false)}
              >
                <Text style={styles.confirmBtnGhostText}>Seguir editando</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnDanger]}
                onPress={() => { setConfirming(false); onClose(); }}
              >
                <Text style={styles.confirmBtnDangerText}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
});

export default ModalShell;

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetPanelWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  centerRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // ── Confirm de descarte in-Modal (P-022) ──
  confirmRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['5'],
  },
  confirmScrim: { backgroundColor: 'rgba(0,0,0,0.72)' },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.bg.raised,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.xl,
    padding: space['5'],
  },
  confirmTitle: {
    color: color.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: space['2'],
  },
  confirmMsg: {
    color: color.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: space['4'],
  },
  confirmBtnRow: { flexDirection: 'row', gap: space['3'] },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnGhost: { backgroundColor: 'transparent' },
  confirmBtnGhostText: { color: color.accent.base, fontSize: 14, fontWeight: '600' },
  confirmBtnDanger: { backgroundColor: color.danger.base },
  confirmBtnDangerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

export type { Props as ModalShellProps };
