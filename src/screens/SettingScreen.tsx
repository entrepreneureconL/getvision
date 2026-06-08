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
  Text as RNText,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { SECTORS, RUBROS, SUBRUBROS } from '../utils/businessProfile';
import type { DetailLevel } from '../schemas/business';
import Container from '../components/Container';
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

type TabKey = 'general' | 'actividad' | 'preferencias';

type Props = {
  businessId: string;
  onBack: () => void;
  onSaved: () => void;
};

export default function SettingsScreen({ businessId, onBack, onSaved }: Props) {
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

  useEffect(() => { loadBusiness(); }, []);

  const loadBusiness = async () => {
    const { data } = await supabase
      .from('businesses')
      .select('name, sector, rubro, subrubro, income_model, detail_level, threshold_hourly_rate')
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
            ]}
          />
        </View>
      </Container>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Container>

          {/* ════════════════ Tab: General ════════════════ */}
          {activeTab === 'general' && (
            <Stack gap="3">
              <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
                Nombre de tu negocio tal como aparece en el dashboard.
              </Text>
              <Text variant="micro" color="secondary" uppercase>Nombre del negocio</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Panadería El Sol"
                placeholderTextColor={color.text.disabled}
                maxLength={100}
              />
              <Text variant="micro" color="tertiary" align="right">
                {name.length}/100
              </Text>
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

      {/* Botón guardar */}
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

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: space['5'],
    backgroundColor: color.bg.base,
    borderTopWidth: 1,
    borderColor: color.border.subtle,
  },
});
