/**
 * SettingScreen — ajustes del negocio.
 *
 * F0-2.5: tab "Preferencias" con detail_level + threshold + income_model opcional.
 * F1-D: refactor a tokens del Design System. Tabs ahora son SegmentedControl,
 *       botón Guardar es <Button>. Lógica de auth/save sin cambios.
 *
 * Nota: el archivo se llama SettingScreen (singular) por un typo F0 documentado
 * en el master §7. La función exportada es SettingsScreen. Renombrar el archivo
 * es deuda cosmética separada.
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet, View, TouchableOpacity,
  ScrollView, SafeAreaView, TextInput, ActivityIndicator, Dimensions,
  Image, Text as RNText,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { SECTORS, RUBROS, SUBRUBROS } from '../utils/businessProfile';
import type { DetailLevel } from '../schemas/business';
import { confirmDestructive } from '../utils/confirm';
import Container from '../components/Container';
import CategoriesEditor from '../components/CategoriesEditor';
import {
  Heading,
  Text,
  Stack,
  Button,
  SegmentedControl,
  Card,
  Chip,
  color,
  space,
  radius,
} from '../design';

const { width } = Dimensions.get('window');

type TabKey = 'general' | 'actividad' | 'preferencias' | 'categorias';

type Props = {
  businessId: string;
  onBack: () => void;
  onSaved: () => void;
  /** Cierre de sesión (lo ejecuta App.handleSignOut, que ya hace el signOut de
   *  Supabase). La fila "Cerrar sesión" lo dispara tras confirmación. */
  onSignOut: () => void;
};

export default function SettingsScreen({ businessId, onBack, onSaved, onSignOut }: Props) {
  const [name, setName]               = useState('');
  const [sector, setSector]           = useState('');
  const [rubro, setRubro]             = useState('');
  const [subrubro, setSubrubro]       = useState('');
  const [incomeModel, setIncomeModel] = useState('mixed');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('simple');
  const [thresholdRate, setThresholdRate] = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [activeTab, setActiveTab]     = useState<TabKey>('general');
  // Item 3 / D-18 — avatar del negocio (logo_url). El upload va a Supabase
  // Storage (bucket `logos`, P-009/IT); el campo y el preview funcionan sin él.
  const [logoUrl, setLogoUrl]                 = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError]         = useState('');

  useEffect(() => { loadBusiness(); }, []);

  const loadBusiness = async () => {
    const { data } = await supabase
      .from('businesses')
      .select('name, sector, rubro, subrubro, income_model, detail_level, threshold_hourly_rate, logo_url')
      .eq('id', businessId)
      .single();
    if (data) {
      setName(data.name ?? '');
      setSector(data.sector ?? '');
      setRubro(data.rubro ?? '');
      setSubrubro(data.subrubro ?? '');
      setIncomeModel(data.income_model ?? 'mixed');
      setDetailLevel((data.detail_level as DetailLevel) ?? 'simple');
      setThresholdRate(
        data.threshold_hourly_rate != null
          ? String(data.threshold_hourly_rate)
          : ''
      );
      setLogoUrl(data.logo_url ?? null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    const thresholdNum = thresholdRate
      ? parseFloat(thresholdRate.replace(',', '.'))
      : null;
    if (thresholdRate && (isNaN(thresholdNum!) || thresholdNum! < 0)) {
      setError('Tarifa aspiracional inválida.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        sector,
        rubro,
        income_model: incomeModel,
        detail_level: detailLevel,
        threshold_hourly_rate: thresholdNum,
      };
      payload.subrubro = subrubro || null;

      const { error: updateError } = await supabase
        .from('businesses')
        .update(payload)
        .eq('id', businessId);
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSaved();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cierre de sesión con confirmación (issue 3). Migrado desde el header del
   * dashboard, donde salía sin preguntar. Usa `confirmDestructive` (mismo patrón
   * que el resto de acciones destructivas — DS modal vía ConfirmProvider). El
   * signOut real lo hace App.handleSignOut detrás de `onSignOut`.
   */
  const handleSignOut = () => {
    confirmDestructive({
      title: '¿Estás seguro que querés salir?',
      message: 'Vas a volver a la pantalla de inicio. Tus datos quedan guardados.',
      confirmLabel: 'Salir',
      cancelLabel: 'Cancelar',
      onConfirm: onSignOut,
    });
  };

  /**
   * Item 3 / D-18 — elegir/cambiar el avatar del negocio. Toma una imagen con
   * expo-image-picker, la sube a Supabase Storage (bucket `logos`) y guarda la
   * URL pública en `businesses.logo_url`. El preview es optimista (uri local).
   * Si el bucket todavía no existe (P-009 pendiente de IT) el upload falla y se
   * muestra un aviso sin romper la pantalla — la foto elegida queda en preview.
   */
  const handlePickAvatar = async () => {
    setAvatarError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError('Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setLogoUrl(asset.uri); // preview optimista
    setUploadingAvatar(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sesión no disponible al subir la foto.');

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const contentType = asset.mimeType ?? 'image/jpeg';
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';

      // Subida vía Edge Function `avatar-upload` (no directo a Storage).
      // Por qué: este proyecto migró a JWT Signing Keys (tokens con `kid`) y el
      // servicio de Storage NO los valida — trata el upload como `anon` y la RLS
      // lo rechaza, aunque PostgREST sí valida el mismo token (verificado en
      // P-009). La Edge Function identifica al usuario con auth.getUser() (GoTrue
      // valida sus propios tokens) y sube con service_role, que saltea la RLS de
      // Storage. La función también escribe businesses.logo_url y nos devuelve la
      // URL pública.
      const uploadRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/avatar-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
            'Content-Type': contentType,
            'x-business-id': businessId,
            'x-file-ext': ext,
          },
          body: blob,
        },
      );
      if (!uploadRes.ok) {
        throw new Error(`avatar-upload ${uploadRes.status}: ${await uploadRes.text()}`);
      }
      const { publicUrl } = await uploadRes.json();

      setLogoUrl(publicUrl);
      onSaved();
    } catch (e) {
      console.error('[avatar] upload/save failed:', e);
      setAvatarError('No se pudo guardar la foto todavía. Probá de nuevo más tarde.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const rubrosForSector = RUBROS[sector] ?? [];
  const subrubrosForRubro = SUBRUBROS[rubro] ?? [];

  const INCOME_MODELS = [
    { key: 'services', label: 'Solo Servicios', icon: '🔧', example: 'plomero, contador, peluquero' },
    { key: 'products', label: 'Solo Productos', icon: '📦', example: 'kiosco, ferretería, tienda' },
    { key: 'mixed',    label: 'Servicios + Productos', icon: '✨', example: 'taller, restaurant, peluquería que vende' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={color.accent.base} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <Container>
        <Stack
          direction="row"
          align="center"
          justify="space-between"
          gap="3"
          style={{
            paddingHorizontal: space['6'],
            paddingTop: space['5'],
            paddingBottom: space['4'],
            borderBottomWidth: 1,
            borderColor: color.border.subtle,
          }}
        >
          <Button variant="ghost" size="sm" onPress={onBack}>
            ← Volver
          </Button>
          <Heading level={4}>Ajustes del negocio</Heading>
          <View style={{ width: 80 }} />
        </Stack>

        {/* Tabs como SegmentedControl */}
        <View style={{ paddingHorizontal: space['6'], paddingVertical: space['4'] }}>
          <SegmentedControl<TabKey>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'general',      label: 'General' },
              { value: 'actividad',    label: 'Actividad' },
              { value: 'preferencias', label: 'Preferencias' },
              { value: 'categorias',   label: 'Categorías' },
            ]}
          />
        </View>
      </Container>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Container>

          {/* ════════════════ Tab: General — Perfil (Item 3 / D-13) ════════════════ */}
          {activeTab === 'general' && (
            <Stack gap="5">
              {/* ── Identidad: avatar + nombre (D-18 logo propio, Item 3) ── */}
              <Card variant="surface" padding="lg">
                <Stack align="center" gap="4">
                  <TouchableOpacity
                    onPress={handlePickAvatar}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar foto de perfil"
                    style={styles.avatarWrap}
                  >
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.avatarImg} />
                    ) : (
                      <RNText style={styles.avatarInitial}>
                        {(name.trim()[0] ?? '?').toUpperCase()}
                      </RNText>
                    )}
                    <View style={styles.avatarBadge}>
                      {uploadingAvatar ? (
                        <ActivityIndicator size="small" color={color.text.primary} />
                      ) : (
                        <Ionicons name="camera" size={16} color={color.text.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                  <Button variant="ghost" size="sm" onPress={handlePickAvatar}>
                    {logoUrl ? 'Cambiar foto' : 'Subir foto'}
                  </Button>
                  {avatarError.length > 0 && (
                    <Text variant="caption" color="danger" align="center">{avatarError}</Text>
                  )}
                </Stack>
              </Card>

              {/* ── Nombre del negocio ── */}
              <Stack gap="2">
                <Text variant="micro" color="secondary" uppercase>Nombre del negocio</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej: Panadería El Sol"
                  placeholderTextColor={color.text.disabled}
                  maxLength={100}
                />
                <Text variant="micro" color="tertiary" align="right">{name.length}/100</Text>
                {rubro.length > 0 && (
                  <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                    {rubro}{sector ? ` · ${sector}` : ''} — tu actividad se edita en la pestaña "Actividad".
                  </Text>
                )}
              </Stack>

              {/* ── Diseño de la App (D-25, F2+) — placeholder bloqueado / coming-soon.
                  Reserva el espacio de UI; la funcionalidad (paleta configurable por
                  grupos) NO se construye todavía. */}
              <View style={styles.lockedCard}>
                <Stack direction="row" align="center" gap="3">
                  <Ionicons name="color-palette-outline" size={22} color={color.text.tertiary} />
                  <Stack gap="1" style={{ flex: 1 }}>
                    <Text variant="bodyStrong" color="secondary">Diseño de la App</Text>
                    <Text variant="caption" color="tertiary">
                      Vas a poder elegir los colores de tu app (ingresos, costos, fondo…).
                    </Text>
                  </Stack>
                  <View style={styles.soonBadge}>
                    <Ionicons name="lock-closed" size={11} color={color.text.tertiary} />
                    <Text variant="micro" color="tertiary">Próximamente</Text>
                  </View>
                </Stack>
              </View>

              {/* ── Sesión (issue 3 — D-13 grupo "Sesión") ──
                  "Cerrar sesión" vive acá, no en el header del dashboard, y pide
                  confirmación antes de salir. Fila destructiva (familia danger). */}
              <View>
                <Text variant="micro" color="secondary" uppercase>Sesión</Text>
                <TouchableOpacity
                  style={styles.signOutRow}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar sesión"
                >
                  <Ionicons name="log-out-outline" size={20} color={color.danger.base} />
                  <Text variant="body" style={{ flex: 1, color: color.danger.base }}>
                    Cerrar sesión
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={color.danger.base} />
                </TouchableOpacity>
              </View>
            </Stack>
          )}

          {/* ════════════════ Tab: Actividad ════════════════ */}
          {activeTab === 'actividad' && (
            <Stack gap="4">
              <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                Sector, rubro y especialización de tu actividad. Cambiarlo afecta los
                indicadores económicos que ves en tu dashboard.
              </Text>

              <Text variant="micro" color="secondary" uppercase>Sector económico</Text>
              <View style={styles.cardsGrid}>
                {SECTORS.map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sectorCard, sector === s.key && styles.sectorCardActive]}
                    onPress={() => { setSector(s.key); setRubro(''); setSubrubro(''); }}
                  >
                    <RNText style={styles.sectorIcon}>{s.icon}</RNText>
                    <Text
                      variant="bodyStrong"
                      color={sector === s.key ? 'accent' : 'primary'}
                      align="center"
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sector.length > 0 && (
                <Stack gap="2" style={{ marginTop: space['4'] }}>
                  <Text variant="micro" color="secondary" uppercase>Rubro</Text>
                  <View style={styles.rubrosList}>
                    {rubrosForSector.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.rubroItem, rubro === r && styles.rubroItemActive]}
                        onPress={() => { setRubro(r); setSubrubro(''); }}
                      >
                        <Text
                          variant="body"
                          color={rubro === r ? 'accent' : 'primary'}
                        >
                          {r}
                        </Text>
                        {rubro === r && <Text variant="bodyStrong" color="accent">✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </Stack>
              )}

              {subrubrosForRubro.length > 0 && (
                <Stack gap="2" style={{ marginTop: space['4'] }}>
                  <Text variant="micro" color="secondary" uppercase>Especialización</Text>
                  <View style={styles.rubrosList}>
                    {subrubrosForRubro.map(sr => (
                      <TouchableOpacity
                        key={sr}
                        style={[styles.rubroItem, subrubro === sr && styles.rubroItemActive]}
                        onPress={() => setSubrubro(sr)}
                      >
                        <Text
                          variant="body"
                          color={subrubro === sr ? 'accent' : 'primary'}
                        >
                          {sr}
                        </Text>
                        {subrubro === sr && <Text variant="bodyStrong" color="accent">✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </Stack>
              )}
            </Stack>
          )}

          {/* ════════════════ Tab: Preferencias ════════════════ */}
          {activeTab === 'preferencias' && (
            <Stack gap="4">
              <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                Cómo querés ver tu negocio y cuál es tu costo de oportunidad.
              </Text>

              <Text variant="micro" color="secondary" uppercase>Nivel de detalle</Text>
              <DetailLevelOption
                icon="🌱"
                title="Simple"
                desc="Una métrica clara, registro rápido con un solo botón."
                active={detailLevel === 'simple'}
                onPress={() => setDetailLevel('simple')}
              />
              <DetailLevelOption
                icon="📊"
                title="Detallado"
                desc="Todos los KPIs visibles: ingresos, costos, stock, horas, balance."
                active={detailLevel === 'detailed'}
                onPress={() => setDetailLevel('detailed')}
              />

              <Stack gap="2" style={{ marginTop: space['4'] }}>
                <Text variant="micro" color="secondary" uppercase>
                  Tarifa aspiracional por hora (opcional)
                </Text>
                <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                  ¿Cuánto te tendría que rendir la hora para sentir que vale la pena?
                  Sirve como comparación. Dejá vacío si todavía no lo definís.
                </Text>
                <TextInput
                  style={styles.input}
                  value={thresholdRate}
                  onChangeText={setThresholdRate}
                  placeholder="Ej: 5000"
                  placeholderTextColor={color.text.disabled}
                  keyboardType="decimal-pad"
                />
              </Stack>

              <Stack gap="2" style={{ marginTop: space['4'] }}>
                <Text variant="micro" color="secondary" uppercase>
                  ¿Tu negocio es de servicios, productos o mixto? (opcional)
                </Text>
                <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                  Lo dejamos en "mixto" por default. Cambialo si querés ver el dashboard
                  más enfocado en uno solo.
                </Text>
                {INCOME_MODELS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modelCard, incomeModel === m.key && styles.modelCardActive]}
                    onPress={() => setIncomeModel(m.key)}
                  >
                    <Stack direction="row" align="center" gap="3">
                      <RNText style={{ fontSize: 28 }}>{m.icon}</RNText>
                      <Stack gap="1" style={{ flex: 1 }}>
                        <Text
                          variant="bodyStrong"
                          color={incomeModel === m.key ? 'accent' : 'primary'}
                        >
                          {m.label}
                        </Text>
                        <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                          Ej: {m.example}
                        </Text>
                      </Stack>
                      {incomeModel === m.key && (
                        <Text variant="bodyStrong" color="accent">✓</Text>
                      )}
                    </Stack>
                  </TouchableOpacity>
                ))}
              </Stack>
            </Stack>
          )}

          {/* ════════════════ Tab: Categorías (F1-L.4) ════════════════ */}
          {activeTab === 'categorias' && (
            <CategoriesEditor
              businessId={businessId}
              rubro={rubro || null}
            />
          )}

          {/* Mensajes */}
          {error.length > 0 && (
            <Card variant="surface" padding="md" style={{ marginTop: space['4'], backgroundColor: color.danger.subtle }}>
              <Text variant="caption" color="danger">⚠️ {error}</Text>
            </Card>
          )}
          {success && (
            <Card variant="surface" padding="md" style={{ marginTop: space['4'], backgroundColor: color.success.subtle }}>
              <Text variant="caption" color="success">✅ Cambios guardados correctamente</Text>
            </Card>
          )}

        </Container>
      </ScrollView>

      {/* Botón guardar — escondido en tab Categorías (auto-persisten). */}
      {activeTab !== 'categorias' && (
        <View style={styles.footer}>
          <Container>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              onPress={handleSave}
            >
              Guardar cambios
            </Button>
          </Container>
        </View>
      )}

    </SafeAreaView>
  );
}

/** Sub-componente local — opción de detail level. */
function DetailLevelOption({
  icon,
  title,
  desc,
  active,
  onPress,
}: {
  icon: string;
  title: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.detailCard, active && styles.detailCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Stack direction="row" align="center" gap="3">
        <RNText style={styles.detailIcon}>{icon}</RNText>
        <Stack gap="1" style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={active ? 'accent' : 'primary'}>
            {title}
          </Text>
          <Text variant="caption" color="secondary">{desc}</Text>
        </Stack>
        {active && <Text variant="bodyStrong" color="accent">✓</Text>}
      </Stack>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },

  scroll: { paddingHorizontal: space['6'], paddingBottom: 110 },

  input: {
    backgroundColor: color.bg.raised,
    color: color.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    fontSize: 15,
    borderWidth: 1,
    borderColor: color.border.default,
  },

  /* Sector cards */
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectorCard: {
    width: (width - 58) / 2,
    backgroundColor: color.bg.raised,
    borderRadius: radius.lg,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.default,
    alignItems: 'center',
  },
  sectorCardActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },
  sectorIcon: { fontSize: 28, marginBottom: 6 },

  /* Rubros / Subrubros */
  rubrosList: { gap: 8 },
  rubroItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.bg.raised,
    borderRadius: radius.md,
    padding: space['3'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  rubroItemActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },

  /* Detail / Model cards */
  detailCard: {
    backgroundColor: color.bg.raised,
    borderRadius: radius.lg,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  detailCardActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },
  detailIcon: { fontSize: 30, width: 40, textAlign: 'center' },

  modelCard: {
    backgroundColor: color.bg.raised,
    borderRadius: radius.lg,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  modelCardActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },

  /* Sesión — fila destructiva "Cerrar sesión" (issue 3) */
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    marginTop: space['2'],
    minHeight: 48,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    backgroundColor: color.danger.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.danger.muted,
  },

  /* Avatar del negocio (Item 3 / D-18) */
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: color.accent.base,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarInitial: { color: color.text.primary, fontSize: 36, fontWeight: '700' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: color.bg.elevated,
    borderWidth: 2, borderColor: color.bg.base,
    alignItems: 'center', justifyContent: 'center',
  },

  /* "Diseño de la App" — placeholder bloqueado / coming-soon (D-25, F2+) */
  lockedCard: {
    backgroundColor: color.bg.raised,
    borderRadius: radius.lg,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.subtle,
    opacity: 0.7,
  },
  soonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space['2'], paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.bg.elevated,
  },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: space['5'],
    backgroundColor: color.bg.base,
    borderTopWidth: 1,
    borderColor: color.border.subtle,
  },
});
