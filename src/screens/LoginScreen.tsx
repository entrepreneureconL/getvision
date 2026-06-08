/**
 * LoginScreen — auth con Supabase (email/password + Google OAuth).
 *
 * F1-D: refactor a Design System. La lógica de auth (Supabase calls, validación,
 * error mapping) se mantiene intacta. Solo cambia el cascarón visual.
 *
 * Cambios visuales clave:
 *   - Toggle Login/Registrarme ahora es <SegmentedControl/> (patrón iPhone).
 *   - Inputs unificados con <Input label error leftIcon rightIcon/>.
 *   - Error/success box ahora es <Card variant="accent"/> con texto semántico.
 *   - Botones con <Button variant="primary|secondary" loading fullWidth>.
 */

import { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  Heading,
  Text,
  Stack,
  Divider,
  Card,
  Button,
  Input,
  SegmentedControl,
  color,
  space,
} from '../design';
import Container from '../components/Container';

type Mode = 'login' | 'signup';

export default function LoginScreen({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  /** Si el mensaje es de éxito (signup confirmación), no es error. */
  const [isSuccess, setIsSuccess] = useState(false);

  const isLogin = mode === 'login';
  const passwordsMatch = password === confirmPassword || isLogin;
  const canSubmit =
    email.length > 0 && password.length >= 8 && passwordsMatch && !loading;

  const clearMessage = () => {
    setErrorMsg('');
    setIsSuccess(false);
  };

  const handleModeChange = (next: Mode) => {
    setMode(next);
    clearMessage();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    clearMessage();
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMsg('Revisá tu email para confirmar tu cuenta.');
        setIsSuccess(true);
      }
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('Invalid login credentials')) {
        setErrorMsg('Email o contraseña incorrectos.');
      } else if (msg.includes('User already registered')) {
        setErrorMsg('Ya existe una cuenta con ese email.');
      } else if (msg.includes('Email not confirmed')) {
        setErrorMsg('Confirmá tu email antes de ingresar.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:8081' },
    });
    if (error) {
      setErrorMsg('Error al iniciar con Google: ' + error.message);
      setIsSuccess(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg.base }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space['6'],
          paddingTop: space['10'],
          paddingBottom: space['8'],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Container>
          {/* Header — Back + Logo */}
          <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: space['8'] }}>
            <Button variant="ghost" size="sm" onPress={onBack}>
              ←  Volver
            </Button>
            <Stack direction="row" gap="0" align="baseline">
              <Heading level={3}>Get</Heading>
              <Heading level={3} color="accent">Vision</Heading>
            </Stack>
          </Stack>

          {/* Toggle login/signup */}
          <View style={{ marginBottom: space['6'] }}>
            <SegmentedControl<Mode>
              value={mode}
              onChange={handleModeChange}
              options={[
                { value: 'login', label: 'Iniciar sesión' },
                { value: 'signup', label: 'Registrarme' },
              ]}
            />
          </View>

          {/* Formulario */}
          <Stack gap="4">
            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              rightIcon={showPassword ? '🙈' : '👁️'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Checklist solo en signup */}
            {!isLogin && (
              <Stack gap="1">
                <PasswordRule ok={password.length >= 8} label="Mínimo 8 caracteres" />
                <PasswordRule ok={/[A-Z]/.test(password)} label="Al menos una mayúscula" />
                <PasswordRule ok={/[0-9]/.test(password)} label="Al menos un número" />
              </Stack>
            )}

            {!isLogin && (
              <Input
                label="Confirmar contraseña"
                placeholder="Repetí tu contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                error={
                  !passwordsMatch && confirmPassword.length > 0
                    ? 'Las contraseñas no coinciden'
                    : undefined
                }
              />
            )}

            {/* Mensaje de estado (error o éxito) */}
            {errorMsg.length > 0 && (
              <Card
                variant="accent"
                padding="md"
                style={{
                  backgroundColor: isSuccess
                    ? color.success.subtle
                    : color.danger.subtle,
                }}
              >
                <Text variant="caption" color={isSuccess ? 'success' : 'danger'}>
                  {errorMsg}
                </Text>
              </Card>
            )}

            {/* CTA */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              {isLogin ? 'Ingresar' : 'Crear cuenta'}
            </Button>

            {/* Divider con "o" — patrón clásico de auth */}
            <Stack direction="row" align="center" gap="3" style={{ marginVertical: space['2'] }}>
              <View style={{ flex: 1 }}>
                <Divider variant="default" />
              </View>
              <Text variant="caption" color="tertiary">o</Text>
              <View style={{ flex: 1 }}>
                <Divider variant="default" />
              </View>
            </Stack>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon="🔵"
              onPress={handleGoogle}
            >
              Continuar con Google
            </Button>
          </Stack>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Subcomponente local — un ítem de la checklist de password. */
function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Text variant="caption" color={ok ? 'success' : 'tertiary'}>
      {ok ? '✓' : '○'}  {label}
    </Text>
  );
}
