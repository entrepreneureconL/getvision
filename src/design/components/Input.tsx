/**
 * <Input /> — campo de texto con label, error y helper.
 *
 * Reemplaza el patrón `<TextInput style={...}/>` con label hardcodeado encima
 * que se repite en LoginScreen, forms y onboarding.
 *
 * Composición visual:
 *   [Label opcional, micro/uppercase]
 *   ┌─────────────────────────────────┐
 *   │ [icono] placeholder / value [X] │
 *   └─────────────────────────────────┘
 *   [Helper text o error en su lugar]
 *
 * Estados:
 *   default  → border subtle
 *   focused  → border accent
 *   error    → border danger + mensaje rojo debajo
 *   disabled → opacity 0.5, no editable
 *
 * Uso:
 *   <Input label="Email" value={email} onChangeText={setEmail}
 *          keyboardType="email-address" autoCapitalize="none" />
 *
 *   <Input label="Contraseña" value={pwd} onChangeText={setPwd}
 *          secureTextEntry error={pwdError} />
 *
 *   <Input value={search} onChangeText={setSearch}
 *          placeholder="Buscar rubro..." leftIcon="🔍" />
 */

import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
  Text,
} from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  /** Label opcional encima del input (micro caps). */
  label?: string;
  /** Mensaje de error. Si está presente, sobrescribe el border y el helper. */
  error?: string;
  /** Texto de ayuda debajo del input (gris). */
  helperText?: string;
  /** Ícono o emoji a la izquierda del campo. */
  leftIcon?: string;
  /** Ícono o emoji a la derecha del campo. */
  rightIcon?: string;
  /** Si se pasa, el rightIcon se vuelve tappable (caso típico: toggle de password). */
  onRightIconPress?: () => void;
  /** Bloquea edición y aplica opacidad. */
  disabled?: boolean;
  /** Estilo extra para el wrapper externo. */
  style?: StyleProp<ViewStyle>;
};

export default function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}: Props) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? color.danger.base
    : focused
    ? color.accent.base
    : color.border.default;

  return (
    <View style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      {label ? (
        <DSText
          variant="micro"
          color="secondary"
          uppercase
          style={{ marginBottom: space['2'] }}
        >
          {label}
        </DSText>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space['2'],
          backgroundColor: color.bg.raised,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: space['3'],
          minHeight: 48,
        }}
      >
        {leftIcon ? (
          <Text style={{ fontSize: tokenText.size.md, color: color.text.secondary }}>
            {leftIcon}
          </Text>
        ) : null}

        <TextInput
          {...textInputProps}
          editable={!disabled}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={color.text.disabled}
          style={{
            flex: 1,
            color: color.text.primary,
            fontSize: tokenText.size.md,
            paddingVertical: space['3'],
            // RN web a veces inyecta outline; lo limpiamos aparte (cast any).
          }}
        />

        {rightIcon ? (
          onRightIconPress ? (
            <TouchableOpacity
              onPress={onRightIconPress}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={{ fontSize: tokenText.size.md, color: color.text.secondary }}>
                {rightIcon}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: tokenText.size.md, color: color.text.secondary }}>
              {rightIcon}
            </Text>
          )
        ) : null}
      </View>

      {error ? (
        <DSText variant="caption" color="danger" style={{ marginTop: space['1'] }}>
          {error}
        </DSText>
      ) : helperText ? (
        <DSText variant="caption" color="tertiary" style={{ marginTop: space['1'] }}>
          {helperText}
        </DSText>
      ) : null}
    </View>
  );
}
