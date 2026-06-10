/**
 * CategoriesEditor — F1-L.4.
 *
 * Editor de categorías del business. Se monta dentro del tab "Categorías" del
 * SettingScreen. Permite:
 *
 *   - Ver defaults agrupados por tipo (income / expense) y archivar/restaurar.
 *   - Ver categorías custom del business y borrarlas (delete físico).
 *   - Crear nueva custom desde cero (reusa AddCategoryModal).
 *   - Crear desde sugerencias por rubro (chips tap-to-create, igual que el
 *     modal — replicado acá para no obligar a abrir el modal).
 *
 * Diseño deliberado:
 *   - SegmentedControl interno alterna Ingresos / Costos. Más prolijo que dos
 *     listas largas concatenadas.
 *   - "Archive ≠ Delete" (ADR #27). Los defaults nunca se borran, solo se
 *     ocultan del picker. Las transactions históricas siguen mostrando el
 *     label original via `resolveCategory`.
 *   - La edición de custom (cambiar label/icon/tint) NO se incluye en esta
 *     versión — borrar y volver a crear es más simple. Si la demanda aparece,
 *     se suma vía `categoriesRepo.update` que ya existe.
 *
 * Estado: gestiona su propia lista de overrides, recarga al crear/archivar/borrar.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, TouchableOpacity, ActivityIndicator,
  Text as RNText,
} from 'react-native';
import { confirmDestructive, alertInfo } from '../utils/confirm';
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  getSuggestedCategoriesForRubro,
  type CategoryDef,
  type CategoryType,
} from '../utils/transactionCategories';
import { categoriesRepo } from '../repos/categories';
import type { CategoryOverride } from '../schemas/categoryOverride';
import AddCategoryModal from './AddCategoryModal';
import {
  Text,
  Stack,
  SegmentedControl,
  Card,
  Button,
  Chip,
  color,
  space,
  radius,
} from '../design';

type Props = {
  businessId: string;
  rubro?: string | null;
};

type Row =
  | { kind: 'default-active'; def: CategoryDef }
  | { kind: 'default-archived'; def: CategoryDef; overrideId: string }
  | { kind: 'custom'; def: CategoryDef; override: CategoryOverride };

const TINT_COLOR: Record<string, string> = {
  success: color.success.base,
  warning: color.warning.base,
  danger:  color.danger.base,
  info:    color.info.base,
  accent:  color.accent.base,
};

export default function CategoriesEditor({ businessId, rubro }: Props) {
  const [overrides, setOverrides] = useState<CategoryOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<CategoryType>('income');
  const [showAdd, setShowAdd] = useState(false);
  const [busyValue, setBusyValue] = useState<string | null>(null);

  const load = async () => {
    const ovs = await categoriesRepo.listForBusiness(businessId);
    setOverrides(ovs);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  /** Filas a renderizar para el tipo activo. Une defaults + customs. */
  const rows: Row[] = useMemo(() => {
    const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const archivedById = new Map<string, CategoryOverride>();
    overrides
      .filter(o => o.is_archived && o.type === type)
      .forEach(o => archivedById.set(o.value, o));

    const defaultValues = new Set(defaults.map(d => d.value));

    const defaultRows: Row[] = defaults.map(d => {
      const archived = archivedById.get(d.value);
      if (archived) return { kind: 'default-archived', def: d, overrideId: archived.id };
      return { kind: 'default-active', def: d };
    });

    const customRows: Row[] = overrides
      .filter(o => !o.is_archived && o.type === type && !defaultValues.has(o.value))
      .map(o => ({
        kind: 'custom',
        def: {
          value: o.value, label: o.label, icon: o.icon,
          tint: o.tint as CategoryDef['tint'], type: o.type as CategoryType,
        },
        override: o,
      }));

    return [...defaultRows, ...customRows];
  }, [overrides, type]);

  const suggestions = useMemo(
    () => getSuggestedCategoriesForRubro(rubro, type, overrides),
    [rubro, type, overrides],
  );

  /** Archive de un default → upsert con is_archived=true. */
  const handleArchive = async (def: CategoryDef) => {
    setBusyValue(def.value);
    const result = await categoriesRepo.archiveDefault({
      business_id: businessId,
      value: def.value,
      label: def.label,
      icon: def.icon,
      tint: def.tint as CategoryOverride['tint'],
      type: def.type,
    });
    await load();
    setBusyValue(null);
    if (!result.ok) alertInfo('No se pudo ocultar', result.message);
  };

  /** Restaurar un default archivado → setArchived(false). */
  const handleRestore = async (overrideId: string, value: string) => {
    setBusyValue(value);
    await categoriesRepo.setArchived(overrideId, false);
    await load();
    setBusyValue(null);
  };

  /** Borrar custom — confirm + delete físico. Cross-platform (Alert no funciona en web). */
  const handleDelete = (override: CategoryOverride) => {
    confirmDestructive({
      title: 'Eliminar categoría',
      message: `¿Borrar "${override.label}"?\n\nLas transacciones viejas seguirán mostrándola con su nombre.`,
      onConfirm: async () => {
        setBusyValue(override.value);
        await categoriesRepo.remove(override.id);
        await load();
        setBusyValue(null);
      },
    });
  };

  /** Crear desde una sugerencia — sin abrir el modal. */
  const handleSuggestionTap = async (s: ReturnType<typeof getSuggestedCategoriesForRubro>[number]) => {
    setBusyValue(s.value);
    const result = await categoriesRepo.create({
      business_id: businessId,
      value: s.value,
      label: s.label,
      icon: s.icon,
      tint: s.tint as CategoryOverride['tint'],
      type,
      suggested_from_rubro: rubro ?? null,
    });
    await load();
    setBusyValue(null);
    if (!result.ok) alertInfo(`No se pudo agregar "${s.label}"`, result.message);
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: space['8'], alignItems: 'center' }}>
        <ActivityIndicator color={color.accent.base} />
      </View>
    );
  }

  return (
    <Stack gap="4">
      <Text variant="caption" color="tertiary" style={{ fontStyle: 'italic' }}>
        Ocultá las que no usás, sumá las que necesites. Lo que cambies acá
        aparece al cobrar o pagar.
      </Text>

      <SegmentedControl<CategoryType>
        value={type}
        onChange={setType}
        options={[
          { value: 'income',  label: 'Ingresos' },
          { value: 'expense', label: 'Costos' },
        ]}
      />

      {/* Sugerencias por rubro */}
      {suggestions.length > 0 && (
        <Card variant="surface" padding="md">
          <Stack gap="2">
            <Text variant="bodyStrong" color="accent">💡 Sugerencias para {rubro}</Text>
            <Text variant="caption" color="tertiary">
              Tocá una para agregarla a tu lista.
            </Text>
            <View style={styles.chipsWrap}>
              {suggestions.map(s => {
                const tintColor = TINT_COLOR[s.tint] ?? color.accent.base;
                const isBusy = busyValue === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: tintColor + '1A', borderColor: tintColor + '66' },
                      busyValue && !isBusy && { opacity: 0.4 },
                    ]}
                    disabled={!!busyValue}
                    onPress={() => handleSuggestionTap(s)}
                    activeOpacity={0.75}
                  >
                    <RNText style={styles.suggestionIcon}>{s.icon}</RNText>
                    <Text variant="caption" color="primary">{s.label}</Text>
                    {isBusy
                      ? <ActivityIndicator size="small" color={tintColor} />
                      : <RNText style={[styles.suggestionPlus, { color: tintColor }]}>+</RNText>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Stack>
        </Card>
      )}

      {/* Botón "Nueva categoría" arriba de la lista */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        onPress={() => setShowAdd(true)}
      >
        + Nueva categoría
      </Button>

      {/* Lista */}
      <Stack gap="2">
        {rows.map(row => (
          <CategoryRow
            key={`${row.kind}:${row.def.value}`}
            row={row}
            busy={busyValue === row.def.value}
            disabled={!!busyValue && busyValue !== row.def.value}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
          />
        ))}
      </Stack>

      <AddCategoryModal
        visible={showAdd}
        businessId={businessId}
        type={type}
        rubro={rubro}
        existingOverrides={overrides}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); load(); }}
      />
    </Stack>
  );
}

function CategoryRow({
  row, busy, disabled, onArchive, onRestore, onDelete,
}: {
  row: Row;
  busy: boolean;
  disabled: boolean;
  onArchive: (def: CategoryDef) => void;
  onRestore: (overrideId: string, value: string) => void;
  onDelete: (o: CategoryOverride) => void;
}) {
  const tintColor = TINT_COLOR[row.def.tint] ?? color.accent.base;
  const isArchived = row.kind === 'default-archived';

  return (
    <View style={[styles.row, isArchived && { opacity: 0.55 }]}>
      <View style={[styles.iconWrap, { backgroundColor: tintColor + '22' }]}>
        <RNText style={styles.iconText}>{row.def.icon}</RNText>
      </View>

      <Stack gap="1" style={{ flex: 1 }}>
        <Text variant="bodyStrong" color="primary">{row.def.label}</Text>
        {row.kind === 'custom' && (
          <Chip variant="accent" size="sm">Tuya</Chip>
        )}
        {row.kind === 'default-archived' && (
          <Text variant="micro" color="tertiary">Oculta del picker</Text>
        )}
      </Stack>

      {busy ? (
        <ActivityIndicator color={color.accent.base} />
      ) : row.kind === 'default-active' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onPress={() => onArchive(row.def)}
        >
          Ocultar
        </Button>
      ) : row.kind === 'default-archived' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onPress={() => onRestore(row.overrideId, row.def.value)}
        >
          Mostrar
        </Button>
      ) : (
        <Button
          variant="danger"
          size="sm"
          disabled={disabled}
          onPress={() => onDelete(row.override)}
        >
          Borrar
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    backgroundColor: color.bg.raised,
    borderRadius: radius.md,
    paddingHorizontal: space['3'],
    paddingVertical: space['3'],
    borderWidth: 1,
    borderColor: color.border.default,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 18 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  suggestionIcon: { fontSize: 14 },
  suggestionPlus: { fontSize: 14, fontWeight: '700' },
});
