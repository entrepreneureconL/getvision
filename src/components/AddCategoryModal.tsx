/**
 * AddCategoryModal — F1-L.3.
 *
 * Mini-modal que se renderea sobre SaleForm/CostForm cuando el usuario tocó
 * el chip "+ Nueva categoría". Pide label + icon + tint, genera el slug del
 * value automáticamente, valida unicidad y crea via categoriesRepo.
 *
 * Mecánica:
 *   - zIndex 200 (forms están en 100) para quedar arriba.
 *   - Al crear con éxito, llama onCreated(newCategory) — el form padre debe
 *     refrescar su lista de overrides + auto-seleccionar el value nuevo.
 *
 * Slug: "Tinte capilar" → "tinte_capilar". Snake case sin diacríticos.
 *
 * Nota UX: si el slug ya existe per business (UNIQUE constraint), el repo
 * devuelve null y mostramos error genérico. En F2 se podría agregar sufijo
 * automático ("_2") o pedir variante manual.
 */

import { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { categoriesRepo } from '../repos/categories';
import { getSuggestedCategoriesForRubro } from '../utils/transactionCategories';
import type {
  CategoryOverride,
  CategoryOverrideTint,
  CategoryOverrideType,
} from '../schemas/categoryOverride';

type Props = {
  visible: boolean;
  businessId: string;
  type: CategoryOverrideType;
  /** F1-L.5: rubro del business para mostrar sugerencias contextuales. */
  rubro?: string | null;
  /** F1-L.5: overrides ya cargados del business — para no sugerir duplicados. */
  existingOverrides?: CategoryOverride[];
  /** Sugerencia inicial del label (futuro: vía SUGGESTED_CATEGORIES_BY_RUBRO). */
  initialLabel?: string;
  onClose: () => void;
  onCreated: (created: CategoryOverride) => void;
};

const ICON_PALETTE = [
  '🎁', '💰', '💳', '✨', '⭐', '🍀', '🎯', '✅',
  '🛒', '🏠', '💡', '📋', '🔧', '📢', '🚚', '⚙️',
  '🍔', '🚗', '📦', '🎨', '✂️', '🛠️', '📱', '💼',
];

const TINT_PALETTE: { value: CategoryOverrideTint; color: string; label: string }[] = [
  { value: 'success', color: '#27AE60', label: 'Verde' },
  { value: 'warning', color: '#E67E22', label: 'Naranja' },
  { value: 'danger',  color: '#C0392B', label: 'Rojo' },
  { value: 'info',    color: '#9B59B6', label: 'Violeta' },
  { value: 'accent',  color: '#1F8579', label: 'Teal' },
];

/**
 * Convierte "Tinte capilar" → "tinte_capilar" (snake case, sin diacríticos,
 * sin caracteres especiales).
 */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function AddCategoryModal({
  visible, businessId, type, rubro, existingOverrides = [],
  initialLabel = '', onClose, onCreated,
}: Props) {
  const [label, setLabel] = useState(initialLabel);
  const [icon, setIcon] = useState<string>(ICON_PALETTE[0]);
  const [tint, setTint] = useState<CategoryOverrideTint>(
    type === 'income' ? 'success' : 'warning',
  );
  const [loading, setLoading] = useState(false);
  const [creatingValue, setCreatingValue] = useState<string | null>(null);
  const [error, setError] = useState('');

  // F1-L.5: sugerencias contextuales por rubro. Filtran duplicados con
  // defaults activos y con overrides existentes (custom o archived).
  const suggestions = useMemo(
    () => getSuggestedCategoriesForRubro(rubro, type, existingOverrides),
    [rubro, type, existingOverrides],
  );

  if (!visible) return null;

  const value = slugify(label);
  const canSubmit = label.trim().length > 0 && value.length > 0 && !loading;

  const handleClose = () => {
    setLabel('');
    setIcon(ICON_PALETTE[0]);
    setTint(type === 'income' ? 'success' : 'warning');
    setError('');
    setCreatingValue(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const result = await categoriesRepo.create({
      business_id: businessId,
      value,
      label: label.trim(),
      icon,
      tint,
      type,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated(result.override);
    handleClose();
  };

  /**
   * F1-L.5: crear directamente desde un chip de sugerencia. Trackea el rubro
   * de origen en `suggested_from_rubro` para futuro análisis ("¿qué sugerencias
   * se aceptan más?"). No pasa por el form manual — un tap, queda creada y
   * seleccionada.
   */
  const handleSuggestionTap = async (s: typeof suggestions[number]) => {
    if (creatingValue) return;
    setCreatingValue(s.value);
    setError('');

    const result = await categoriesRepo.create({
      business_id: businessId,
      value: s.value,
      label: s.label,
      icon: s.icon,
      tint: s.tint,
      type,
      suggested_from_rubro: rubro ?? null,
    });
    setCreatingValue(null);

    if (!result.ok) {
      setError(`"${s.label}": ${result.message}`);
      return;
    }
    onCreated(result.override);
    handleClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>

        <View style={styles.header}>
          <Text style={styles.title}>+ Nueva categoría</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>💡 Sugerencias para {rubro}</Text>
            <Text style={styles.suggestionsHint}>Tocá una para agregarla.</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
            >
              {suggestions.map(s => {
                const tintColor = TINT_PALETTE.find(t => t.value === s.tint)?.color ?? '#1F8579';
                const isCreating = creatingValue === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: tintColor + '1A', borderColor: tintColor + '66' },
                      creatingValue && !isCreating && { opacity: 0.4 },
                    ]}
                    onPress={() => handleSuggestionTap(s)}
                    disabled={!!creatingValue}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.suggestionIcon}>{s.icon}</Text>
                    <Text style={styles.suggestionLabel}>{s.label}</Text>
                    {isCreating
                      ? <ActivityIndicator size="small" color={tintColor} />
                      : <Text style={[styles.suggestionPlus, { color: tintColor }]}>+</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.divider} />
            <Text style={styles.suggestionsManualHint}>O creá una tuya desde cero:</Text>
          </View>
        )}

        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Tinte capilar"
          placeholderTextColor="#4A4A6A"
          value={label}
          onChangeText={setLabel}
          maxLength={80}
          autoFocus
        />
        {label.length > 0 && (
          <Text style={styles.slugHint}>
            Se guardará como: <Text style={styles.slugMono}>{value}</Text>
          </Text>
        )}

        <Text style={styles.label}>Ícono</Text>
        <View style={styles.iconGrid}>
          {ICON_PALETTE.map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={[styles.iconCell, icon === emoji && styles.iconCellActive]}
              onPress={() => setIcon(emoji)}
            >
              <Text style={styles.iconEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.tintRow}>
          {TINT_PALETTE.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.tintChip,
                { backgroundColor: t.color + '22', borderColor: t.color },
                tint === t.value && { borderWidth: 2 },
              ]}
              onPress={() => setTint(t.value)}
            >
              <View style={[styles.tintDot, { backgroundColor: t.color }]} />
              <Text style={styles.tintLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error.length > 0 && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>Crear y elegir</Text>}
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    padding: 20,
  },
  panel: {
    backgroundColor: '#12122A', borderRadius: 16, padding: 22,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  title: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  close: { color: '#7F8C8D', fontSize: 20 },
  label: { color: '#A0A0B8', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  slugHint: { color: '#7F8C8D', fontSize: 11, marginTop: 4 },
  slugMono: { color: '#A0A0B8', fontFamily: 'monospace', fontSize: 11 },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconCell: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: '#1A1A2E',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  iconCellActive: { borderColor: '#1F8579', backgroundColor: '#0F2A26' },
  iconEmoji: { fontSize: 20 },

  tintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tintChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
  tintDot: { width: 10, height: 10, borderRadius: 5 },
  tintLabel: { color: '#FFF', fontSize: 12 },

  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 10, marginTop: 14,
  },
  errorText: { color: '#E74C3C', fontSize: 12 },

  saveBtn: {
    backgroundColor: '#1F8579', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: 18,
  },
  saveBtnDisabled: { backgroundColor: '#0E423C', opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // F1-L.5 — sección de sugerencias por rubro
  suggestionsSection: { marginBottom: 4 },
  suggestionsTitle: { color: '#FFF', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  suggestionsHint: { color: '#7F8C8D', fontSize: 11, marginBottom: 10 },
  suggestionsRow: { gap: 8, paddingRight: 4 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionIcon: { fontSize: 16 },
  suggestionLabel: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  suggestionPlus: { fontSize: 16, fontWeight: '700' },
  divider: {
    height: 1, backgroundColor: '#2A2A4A',
    marginTop: 14, marginBottom: 10,
  },
  suggestionsManualHint: { color: '#7F8C8D', fontSize: 11, fontStyle: 'italic' },
});
