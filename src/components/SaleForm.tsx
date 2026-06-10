import { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { confirmDestructive } from '../utils/confirm';
import { supabase } from '../lib/supabase';
import {
  getCategoriesForType,
  paymentMethodFromAccountKind,
  resolveCategory,
} from '../utils/transactionCategories';
import { todayLocalISO } from '../utils/periods';
import { transactionsRepo } from '../repos/transactions';
import { accountsRepo } from '../repos/accounts';
import { categoriesRepo } from '../repos/categories';
import AddCategoryModal from './AddCategoryModal';
import type { Transaction } from '../schemas/transaction';
import type { Account } from '../schemas/account';
import type { CategoryOverride } from '../schemas/categoryOverride';

const { width } = Dimensions.get('window');
const ACCENT = '#2E86C1';

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
  /** Si está presente, el form trabaja en modo edición. F1-D Task #11. */
  transaction?: Transaction;
  /** F1-L.5: rubro del business para sugerencias contextuales en AddCategoryModal. */
  rubro?: string | null;
};

// F1-K.1 (ADR #22): el picker de "Forma de cobro" se eliminó. payment_method
// ahora se deriva del kind de la cuenta seleccionada al guardar — la cuenta
// ya contiene esa información.
// F1-L: las categorías ya NO se computan a module-level; se componen dentro
// del componente con los overrides del business (defaults + custom − archived).

export default function SaleForm({ businessId, onSuccess, onClose, transaction, rubro }: Props) {
  const isEdit = !!transaction;

  // F1-L: si transaction.category resuelve a un default (vía LEGACY_MAP o match
  // directo), usamos el value mapeado. Si no resuelve, lo dejamos como string
  // crudo — una vez carguen los overrides del business, el chip va a matchear
  // contra una custom existente. Default genérico 'product' para new.
  const initialCategory = transaction?.category
    ? (resolveCategory(transaction.category)?.value ?? transaction.category)
    : 'product';

  // F1-L: overrides del business (customs + archives). Se cargan junto a accounts.
  // Drive del picker via useMemo abajo.
  const [overrides, setOverrides] = useState<CategoryOverride[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const categories = useMemo(
    () => getCategoriesForType('income', overrides),
    [overrides],
  );

  // F1-J.5b: estado de stock/flujo separado del payment_method.
  //   isSettled  → true si "ya cobré" (settled_at != null en DB).
  //   accountId  → cuenta destino cuando isSettled = true (to_account_id).
  // Default para new: isSettled=true (caso típico — la mayoría cobra al momento).
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSettled, setIsSettled] = useState<boolean>(
    isEdit ? transaction!.settled_at != null : true
  );
  const [accountId, setAccountId] = useState<string | null>(
    transaction?.to_account_id ?? null
  );

  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount).replace('.', ',') : '',
  );
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [category, setCategory] = useState<string>(initialCategory);
  const [date, setDate] = useState(
    transaction?.date ?? todayLocalISO(),
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  /** F1-J/L: cargar cuentas + overrides en paralelo al montar. */
  useEffect(() => {
    let active = true;
    (async () => {
      const [accs, ovs] = await Promise.all([
        accountsRepo.listActive(businessId),
        categoriesRepo.listForBusiness(businessId),
      ]);
      if (!active) return;
      setAccounts(accs);
      setOverrides(ovs);
      if (!accountId) {
        const def = accs.find(a => a.is_default) ?? accs[0];
        if (def) setAccountId(def.id);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const amountNumber = parseFloat(amount.replace(',', '.'));
  // Validación F1-J.5b: si "ya cobré" pero no hay cuenta elegida, bloqueamos.
  // Si "pendiente", la cuenta no es requerida.
  const canSubmit = !isNaN(amountNumber)
    && amountNumber > 0
    && !loading
    && (!isSettled || accountId != null);

  const handleSave = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    // Derivados F1-J: cuando no está saldado, todo lo de stock va null.
    // F1-K.1: payment_method se deriva del kind de la cuenta destino.
    const settledAt = isSettled ? date : null;
    const toAccountId = isSettled ? accountId : null;
    const selectedAccount = isSettled && accountId
      ? accounts.find(a => a.id === accountId)
      : null;
    const finalPaymentMethod = selectedAccount
      ? paymentMethodFromAccountKind(selectedAccount.kind)
      : null;

    try {
      if (isEdit && transaction) {
        const ok = await transactionsRepo.update(transaction.id, {
          amount: amountNumber,
          date,
          payment_method: finalPaymentMethod,
          category,
          description: description || null,
          status: isSettled ? 'completed' : 'pending', // mirror legacy
          settled_at: settledAt,
          to_account_id: toAccountId,
        });
        if (!ok) throw new Error('No se pudo actualizar la venta.');
      } else {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            business_id: businessId,
            type: 'income',
            amount: amountNumber,
            date,
            payment_method: finalPaymentMethod,
            category,
            description: description || null,
            status: isSettled ? 'completed' : 'pending',
            settled_at: settledAt,
            to_account_id: toAccountId,
          });
        if (insertError) throw insertError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la venta.');
    } finally {
      setLoading(false);
    }
  };

  /** Eliminar — solo en modo edit. Pide confirmación cross-platform antes de borrar. */
  const handleDelete = () => {
    if (!isEdit || !transaction) return;
    confirmDestructive({
      title: '¿Eliminar esta venta?',
      message: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setDeleting(true);
        setError('');
        const ok = await transactionsRepo.remove(transaction.id);
        setDeleting(false);
        if (ok) onSuccess();
        else setError('No se pudo eliminar la venta.');
      },
    });
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>

        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{isEdit ? '✏️ Editar venta' : '💵 Nueva Venta'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          <Text style={styles.label}>Monto de la venta *</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#4A4A6A"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          <Text style={styles.label}>Tipo de venta</Text>
          <View style={styles.chipsRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.chip, category === cat.value && styles.chipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>
                  {cat.icon}  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
            {/* F1-L: + Nueva — abre AddCategoryModal */}
            <TouchableOpacity
              style={[styles.chip, styles.chipAdd]}
              onPress={() => setShowAddCategory(true)}
            >
              <Text style={[styles.chipText, styles.chipAddText]}>+ Nueva</Text>
            </TouchableOpacity>
          </View>

          {/* F1-J.5b: estado del cobro */}
          <Text style={styles.label}>Estado del cobro</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, isSettled && styles.chipActiveGreen]}
              onPress={() => setIsSettled(true)}
            >
              <Text style={[styles.chipText, isSettled && styles.chipTextActive]}>
                ✓ Ya cobré
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, !isSettled && styles.chipActivePending]}
              onPress={() => setIsSettled(false)}
            >
              <Text style={[styles.chipText, !isSettled && styles.chipTextActive]}>
                ⏳ Pendiente
              </Text>
            </TouchableOpacity>
          </View>

          {/* F1-K.1: solo cuenta destino — payment_method se deriva del kind. */}
          {isSettled && accounts.length > 0 && (
            <>
              <Text style={styles.label}>¿Dónde entró la plata?</Text>
              <View style={styles.chipsRow}>
                {accounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.chip, accountId === a.id && styles.chipActiveGreen]}
                    onPress={() => setAccountId(a.id)}
                  >
                    <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* F1-J.5b: ayuda contextual cuando "pendiente" */}
          {!isSettled && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ⏳ Esta venta queda en "Por cobrar". Vas a poder marcarla como cobrada
                cuando entre la plata, eligiendo en qué cuenta.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Fecha</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#4A4A6A"
          />

          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Venta a cliente Juan, 3 unidades..."
            placeholderTextColor="#4A4A6A"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={120}
          />
          <Text style={styles.charCount}>{description.length}/120</Text>

          {error.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Guardar venta'}</Text>
            }
          </TouchableOpacity>

          {/* Botón eliminar solo en modo edit. F1-D Task #11. */}
          {isEdit && (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#E74C3C" />
                : <Text style={styles.deleteBtnText}>🗑 Eliminar venta</Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>
      </View>

      {/* F1-L: modal de creación de categoría custom. zIndex 200 (encima del form). */}
      <AddCategoryModal
        visible={showAddCategory}
        businessId={businessId}
        type="income"
        rubro={rubro}
        existingOverrides={overrides}
        onClose={() => setShowAddCategory(false)}
        onCreated={(created) => {
          setOverrides(prev => [...prev, created]);
          setCategory(created.value);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end', zIndex: 100,
  },
  panel: {
    backgroundColor: '#12122A', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
    maxHeight: '90%', borderTopWidth: 1, borderColor: '#1A6B3A',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 8 },
  closeText: { color: '#7F8C8D', fontSize: 20 },
  label: { color: '#A0A0B8', fontSize: 13, marginBottom: 8, marginTop: 16 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 12,
    borderWidth: 1, borderColor: '#1A6B3A', paddingHorizontal: 16,
  },
  currency: { color: '#1A6B3A', fontSize: 24, fontWeight: 'bold', marginRight: 8 },
  amountInput: {
    flex: 1, color: '#FFFFFF', fontSize: 32,
    fontWeight: 'bold', paddingVertical: 16,
  },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: { color: '#4A4A6A', fontSize: 11, textAlign: 'right', marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: ACCENT },
  chipActiveGreen: { backgroundColor: '#0D2B1A', borderColor: '#1A6B3A' },
  /** F1-J.5b: estado "pendiente" — amarillo/ámbar para diferenciar del cobrado. */
  chipActivePending: { backgroundColor: '#2B2200', borderColor: '#A67800' },
  /** F1-L: chip "+ Nueva categoría" — borde dashed teal, distinto del seleccionable. */
  chipAdd: { borderColor: '#1F8579', borderStyle: 'dashed' },
  chipAddText: { color: '#1F8579' },
  chipText: { color: '#7F8C8D', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 12, marginTop: 16,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  /** F1-J.5b: caja de ayuda contextual cuando el cobro queda pendiente. */
  infoBox: {
    backgroundColor: '#1A1500', borderWidth: 1, borderColor: '#3A2E00',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  infoText: { color: '#D6BF66', fontSize: 12, lineHeight: 17 },
  saveBtn: {
    backgroundColor: '#1A6B3A', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 24, marginBottom: 8,
  },
  saveBtnDisabled: { backgroundColor: '#0D2B1A', opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    marginTop: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#7A241C', backgroundColor: 'rgba(192,57,43,0.08)',
  },
  deleteBtnText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});
