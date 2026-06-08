/**
 * OnboardingScreen — flujo de configuración inicial del negocio.
 *
 * F0-2.5: pasos rediseñados (sin income_model, con detail_level).
 * F0-9:   reorganización de sectores; búsqueda en paso Rubro/Subrubro.
 * F0-10:  buscador TRANSVERSAL en todos los pasos.
 * F0-11:  filtrado de Industria y Agro en la UI de onboarding.
 * F1-D:   refactor cosmético a tokens del Design System. Lógica intacta.
 */

import { useState, useMemo } from 'react';
import {
  StyleSheet, View, TouchableOpacity,
  ScrollView, SafeAreaView, Dimensions, ActivityIndicator,
  TextInput, Text as RNText,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { SECTORS, RUBROS, SUBRUBROS } from '../utils/businessProfile';
import { searchAllLevels, type SearchResult } from '../utils/search';
import Container from '../components/Container';
import HighlightedText from '../components/HighlightedText';
import {
  Heading,
  Text,
  Stack,
  Button,
  color,
  space,
  radius,
} from '../design';

const { width } = Dimensions.get('window');
const IS_WIDE = width > 600;

// F0-11: sectores visibles en la primera versión.
const VISIBLE_SECTOR_KEYS = ['services', 'commerce'];

type StepKey = 'sector' | 'rubro' | 'subrubro' | 'detail_level';

type Props = { businessId: string; onComplete: () => void };

export default function OnboardingScreen({ businessId, onComplete }: Props) {
  const [stepIdx, setStepIdx]         = useState(0);
  const [sector, setSector]           = useState('');
  const [rubro, setRubro]             = useState('');
  const [subrubro, setSubrubro]       = useState('');
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>('simple');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [searchText, setSearchText]   = useState('');

  const steps = useMemo<StepKey[]>(() => {
    const base: StepKey[] = ['sector', 'rubro'];
    if (rubro && (SUBRUBROS[rubro]?.length ?? 0) > 0) {
      base.push('subrubro');
    }
    base.push('detail_level');
    return base;
  }, [rubro]);

  const currentStep = steps[stepIdx];
  const totalSteps  = steps.length;
  const stepNumber  = stepIdx + 1;

  const searchResults: SearchResult[] = useMemo(() => {
    return searchAllLevels(searchText, {
      visibleSectors: VISIBLE_SECTOR_KEYS,
    });
  }, [searchText]);

  const hasActiveSearch = searchText.trim().length > 0;

  const handleSearchResultPick = (r: SearchResult) => {
    const newRubro    = r.rubro ?? '';
    const newSubrubro = r.subrubro ?? '';

    setSector(r.sector);
    setRubro(newRubro);
    setSubrubro(newSubrubro);
    setSearchText('');

    const hasSubsForNewRubro = (SUBRUBROS[newRubro]?.length ?? 0) > 0;
    const newSteps: StepKey[] = ['sector', 'rubro'];
    if (hasSubsForNewRubro) newSteps.push('subrubro');
    newSteps.push('detail_level');

    let target: StepKey;
    if (r.level === 'sector') {
      target = 'rubro';
    } else if (r.level === 'rubro') {
      target = hasSubsForNewRubro ? 'subrubro' : 'detail_level';
    } else {
      target = 'detail_level';
    }

    const idx = newSteps.indexOf(target);
    if (idx >= 0) setStepIdx(idx);
  };

  const handleSectorSelect = (key: string) => {
    setSector(key);
    setRubro('');
    setSubrubro('');
  };

  const handleRubroSelect = (r: string) => {
    setRubro(r);
    setSubrubro('');
  };

  const handleNext = () => {
    if (stepIdx < totalSteps - 1) {
      setStepIdx(stepIdx + 1);
      setSearchText('');
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
      setSearchText('');
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        sector,
        rubro,
        detail_level: detailLevel,
        onboarding_completed: true,
      };
      if (subrubro) payload.subrubro = subrubro;

      const { error: updateError } = await supabase
        .from('businesses')
        .update(payload)
        .eq('id', businessId);
      if (updateError) throw updateError;
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Error al guardar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = (() => {
    if (currentStep === 'sector') return !!sector;
    if (currentStep === 'rubro') return !!rubro;
    if (currentStep === 'subrubro') return !!subrubro;
    if (currentStep === 'detail_level') return !!detailLevel;
    return false;
  })();

  const visibleSectors = SECTORS.filter(s => VISIBLE_SECTOR_KEYS.includes(s.key));
  const rubrosForSector = RUBROS[sector] ?? [];
  const subrubrosForRubro = SUBRUBROS[rubro] ?? [];
  const isLastStep = stepIdx === totalSteps - 1;

  const searchPlaceholder = (() => {
    if (currentStep === 'sector')      return '🔍 Buscar tu actividad (ej: peluquería, kiosco, plomero)';
    if (currentStep === 'rubro')       return '🔍 Buscar (ej: alimentos, salud, taller)';
    if (currentStep === 'subrubro')    return '🔍 Buscar especialización';
    return '';
  })();

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Barra de progreso ── */}
      <Container>
        <View style={styles.progressContainer}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.progressBar, i <= stepIdx && styles.progressBarActive]}
            />
          ))}
        </View>
      </Container>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Container>

          {/* ════════════════ Paso: Sector ════════════════ */}
          {currentStep === 'sector' && !hasActiveSearch && (
            <Stack gap="4">
              <Text variant="captionStrong" color="accent">
                Paso {stepNumber} de {totalSteps}
              </Text>
              <Heading level={1}>¿A qué sector pertenece{'\n'}tu negocio?</Heading>
              <Text variant="body" color="tertiary">
                Esto nos ayuda a mostrarte indicadores económicos relevantes para tu actividad.
                Si ya sabés qué hacés, buscalo arriba directamente.
              </Text>

              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder={searchPlaceholder}
                placeholderTextColor={color.text.disabled}
              />

              <View style={styles.sectorGrid}>
                {visibleSectors.map(s => {
                  const isActive = sector === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.sectorCard, isActive && styles.sectorCardActive]}
                      onPress={() => handleSectorSelect(s.key)}
                      activeOpacity={0.8}
                    >
                      {isActive && (
                        <View style={styles.sectorCheckBadge}>
                          <RNText style={styles.sectorCheckText}>✓</RNText>
                        </View>
                      )}
                      <RNText style={styles.sectorIcon}>{s.icon}</RNText>
                      <Text
                        variant="bodyStrong"
                        color={isActive ? 'accent' : 'primary'}
                        align="center"
                      >
                        {s.label}
                      </Text>
                      <Text variant="caption" color="tertiary" align="center">
                        {s.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Stack>
          )}

          {/* ════════════════ Paso: Rubro ════════════════ */}
          {currentStep === 'rubro' && !hasActiveSearch && (
            <Stack gap="4">
              <Text variant="captionStrong" color="accent">
                Paso {stepNumber} de {totalSteps}
              </Text>
              <Heading level={1}>¿Cuál es tu rubro?</Heading>
              <Text variant="body" color="tertiary">
                Seleccioná el que mejor describe tu actividad principal.
              </Text>

              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder={searchPlaceholder}
                placeholderTextColor={color.text.disabled}
              />

              <View style={styles.rubrosList}>
                {rubrosForSector.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rubroItem, rubro === r && styles.rubroItemActive]}
                    onPress={() => handleRubroSelect(r)}
                    activeOpacity={0.8}
                  >
                    <Text variant="body" color={rubro === r ? 'accent' : 'primary'}>
                      {r}
                    </Text>
                    {rubro === r && <Text variant="bodyStrong" color="accent">✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </Stack>
          )}

          {/* ════════════════ Paso: Subrubro ════════════════ */}
          {currentStep === 'subrubro' && !hasActiveSearch && (
            <Stack gap="4">
              <Text variant="captionStrong" color="accent">
                Paso {stepNumber} de {totalSteps}
              </Text>
              <Heading level={1}>Para afinar más,{'\n'}¿qué hacés exactamente?</Heading>
              <Text variant="body" color="tertiary">
                Cada actividad tiene sus números. Elegí la que más se parezca a la tuya.
              </Text>

              {subrubrosForRubro.length >= 5 && (
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={color.text.disabled}
                />
              )}

              <View style={styles.rubrosList}>
                {subrubrosForRubro.map(sr => (
                  <TouchableOpacity
                    key={sr}
                    style={[styles.rubroItem, subrubro === sr && styles.rubroItemActive]}
                    onPress={() => setSubrubro(sr)}
                    activeOpacity={0.8}
                  >
                    <Text variant="body" color={subrubro === sr ? 'accent' : 'primary'}>
                      {sr}
                    </Text>
                    {subrubro === sr && <Text variant="bodyStrong" color="accent">✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </Stack>
          )}

          {/* ════════════════ Paso: Detail level ════════════════ */}
          {currentStep === 'detail_level' && (
            <Stack gap="4">
              <Text variant="captionStrong" color="accent">
                Paso {stepNumber} de {totalSteps}
              </Text>
              <Heading level={1}>¿Cómo querés ver{'\n'}tu negocio?</Heading>
              <Text variant="body" color="tertiary">
                Podés cambiar esto cuando quieras desde Ajustes.
              </Text>

              <DetailOption
                icon="🌱"
                title="Simple"
                desc="Solo lo esencial. Una métrica clara, un botón para registrar. Ideal si recién arrancás o no querés perderte en detalles."
                active={detailLevel === 'simple'}
                onPress={() => setDetailLevel('simple')}
              />

              <DetailOption
                icon="📊"
                title="Detallado"
                desc="Todos los números. Ingresos, costos, stock, horas, balance, composición. Para cuando querés analizar a fondo."
                active={detailLevel === 'detailed'}
                onPress={() => setDetailLevel('detailed')}
              />

              {error.length > 0 && (
                <View style={styles.errorBox}>
                  <Text variant="caption" color="danger">⚠️ {error}</Text>
                </View>
              )}
            </Stack>
          )}

          {/* ════════════════ Resultados de búsqueda transversal ════════════════ */}
          {hasActiveSearch && currentStep !== 'detail_level' && (
            <Stack gap="4">
              <Text variant="captionStrong" color="accent">
                Paso {stepNumber} de {totalSteps}
              </Text>
              <Heading level={1}>Buscador</Heading>
              <Text variant="body" color="tertiary">
                Buscamos en todos los rubros y especialidades. Tocá un resultado
                y completamos lo demás por vos.
              </Text>

              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder={searchPlaceholder}
                placeholderTextColor={color.text.disabled}
                autoFocus
              />

              {searchResults.length === 0 ? (
                <Text variant="caption" color="tertiary" align="center" style={{ paddingVertical: space['6'], fontStyle: 'italic' }}>
                  Nada coincide con "{searchText}". Probá otra palabra o cerrá el
                  buscador (borrá el texto) para elegir manualmente.
                </Text>
              ) : (
                <View style={styles.rubrosList}>
                  {searchResults.map((r, i) => (
                    <TouchableOpacity
                      key={`${r.level}-${r.label}-${i}`}
                      style={styles.searchResultItem}
                      onPress={() => handleSearchResultPick(r)}
                      activeOpacity={0.75}
                    >
                      <HighlightedText
                        text={r.label}
                        start={r.matchStart}
                        end={r.matchEnd}
                        baseStyle={styles.searchResultLabel}
                        highlightStyle={styles.searchResultMatch}
                      />
                      <Text variant="micro" color="tertiary" style={{ fontStyle: 'italic' }}>
                        {r.sectorLabel}
                        {r.rubro && r.level !== 'rubro' ? ` › ${r.rubro}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Stack>
          )}

        </Container>
      </ScrollView>

      {/* ── Navegación ── */}
      <View style={styles.navRow}>
        <Container>
          <Stack direction="row" gap="3">
            {stepIdx > 0 ? (
              <View style={{ flex: 1 }}>
                <Button variant="secondary" size="lg" fullWidth onPress={handleBack}>
                  ← Atrás
                </Button>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <View style={{ flex: 2 }}>
              {isLastStep ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  disabled={!canContinue}
                  onPress={handleComplete}
                >
                  Ir a mi Dashboard ✓
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!canContinue}
                  onPress={handleNext}
                >
                  Continuar →
                </Button>
              )}
            </View>
          </Stack>
        </Container>
      </View>

    </SafeAreaView>
  );
}

/** Card de opción de detail level. Local porque solo se usa acá. */
function DetailOption({
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

const CARD_GAP  = 12;
const H_PAD     = 24;
const CARD_SIZE = IS_WIDE
  ? 200
  : (width - H_PAD * 2 - CARD_GAP) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },

  progressContainer: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: H_PAD, paddingTop: 20, paddingBottom: 8,
  },
  progressBar:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.border.default },
  progressBarActive: { backgroundColor: color.accent.base },

  scroll: { paddingHorizontal: H_PAD, paddingTop: 24, paddingBottom: 120 },

  /* Buscador */
  searchInput: {
    backgroundColor: color.bg.raised,
    color: color.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    fontSize: 14,
    borderWidth: 1,
    borderColor: color.border.default,
  },

  /* Resultados de búsqueda */
  searchResultItem: {
    backgroundColor: color.bg.raised,
    borderRadius: radius.md,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  searchResultLabel: {
    color: color.text.primary,
    fontSize: 15,
    marginBottom: 4,
  },
  searchResultMatch: {
    color: color.accent.base,
    fontWeight: 'bold',
  },

  /* Cards de Sector */
  sectorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP,
  },
  sectorCard: {
    width: CARD_SIZE, aspectRatio: 0.9,
    backgroundColor: color.bg.raised,
    borderRadius: radius.xl,
    padding: space['5'],
    borderWidth: 1.5,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: space['2'],
  },
  sectorCardActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },
  sectorCheckBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: color.accent.base,
    alignItems: 'center', justifyContent: 'center',
  },
  sectorCheckText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  sectorIcon:  { fontSize: IS_WIDE ? 48 : 40, marginBottom: 8 },

  /* Rubros / Subrubros */
  rubrosList: { gap: 8 },
  rubroItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: color.bg.raised,
    borderRadius: radius.md,
    padding: space['4'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  rubroItemActive: {
    borderColor: color.accent.base,
    backgroundColor: color.accent.subtle,
  },

  /* Detail level */
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
  detailIcon: { fontSize: 32, width: 44, textAlign: 'center' },

  /* Error */
  errorBox: {
    backgroundColor: color.danger.subtle,
    borderWidth: 1,
    borderColor: color.danger.muted,
    borderRadius: radius.md,
    padding: space['3'],
  },

  /* Navegación */
  navRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: H_PAD,
    paddingVertical: space['5'],
    backgroundColor: color.bg.base,
    borderTopWidth: 1,
    borderColor: color.border.subtle,
  },
});
