/**
 * <ContextualHint /> — banner de anticipación nivel 1 (D-5).
 *
 * Una sola línea, tono sutil (accent.subtle), descartable con ✕. Aparece
 * solo cuando `getContextualHint` devuelve algo — la mayoría del tiempo no
 * existe. Nunca bloquea nada: es una invitación, no un aviso.
 *
 * Principio §2.5 GETVISION_DESIGN: anticipar sin invadir. Si el usuario lo
 * descarta, no vuelve en la sesión (el caller maneja ese estado).
 */

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContextualHint as Hint } from '../utils/anticipation';
import { Text, color, radius, space } from '../design';

type Props = {
  hint: Hint;
  onAction: (hint: Hint) => void;
  onDismiss: (hint: Hint) => void;
};

export default function ContextualHint({ hint, onAction, onDismiss }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space['2'],
        backgroundColor: color.accent.subtle,
        borderRadius: radius.md,
        paddingVertical: space['2'],
        paddingHorizontal: space['3'],
      }}
    >
      <Ionicons name="sparkles-outline" size={14} color={color.accent.base} />

      <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
        {hint.text}
      </Text>

      <TouchableOpacity
        onPress={() => onAction(hint)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text variant="captionStrong" color="accent">
          {hint.actionLabel} →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onDismiss(hint)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
      >
        <Ionicons name="close" size={14} color={color.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}
