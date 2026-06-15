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
import { eventsRepo } from '../repos/events';
import AddCategoryModal from './AddCategoryModal';
import type { Transaction } from '../schemas/transaction';
import type { Account } from '../schemas/account';
import type { CategoryOverride } from '../schemas/categoryOverride';
import { ModalShell } from '../design';

const { width } = Dimensions.get('window');
const FORM_WIDTH = Math.min(400, width - 48);

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
  /** Si está presente, el form trabaja en modo edición. F1-D Task #11. */
  transaction?: Transaction;
  /** F1-L.5: rubro del business para sugerencias contextuales en AddCategoryModal. */
  rubro?: string | null;
};

// F1-K.1 (ADR #22): el picker de "Forma de pago" se eliminó. payment_method
// ahora se deriva del kind de la cuenta seleccionada al guardar.
// F1-L: las categorías se componen dentro del componente con overrides.

export default function CostForm({ businessId, onSuccess, onClose, transaction, rubro }: Props) {
  const isEdit = !!transaction;

  const initialCategory = transaction?.category
    ? (resolveCategory(transaction.category)?.value ?? transaction.category)
    : 'supplies';

  // F1-L: overrides del business.
  const [overrides, setOverrides] = useState<CategoryOverride[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const categories = useMemo(
    () => getCategoriesForType('expense', overrides),
    [overrides],
  );

  // F1-J.5b: en costos hablamos de from_account_id (la cuenta que paga).
  // Default para new: isSettled=true (caso típico — pagás al momento).
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSettled, setIsSettled] = useState<boolean>(
    isEdit ? transaction!.settled_at != null : true
  );
  const [accountId, setAccountId] = useState<string | null>(
    transaction?.from_account_id ?? null
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
  const canSubmit = !isNaN(amountNumber)
    && amountNumber > 0
    && !loading
    && (!isSettled || accountId != null);

  // D-20.b — ¿cambios sin guardar? (mismo criterio que SaleForm). Backdrop/Esc
  // piden confirmación antes de descartar; el × cierra directo.
  const initialAmountStr = transaction ? String(transaction.amount).replace('.', ',') : '';
  const initialDate = transaction?.date ?? todayLocalISO();
  const initialSettled = isEdit ? transaction!.settled_at != null : true;
  const dirty = isEdit
    ? amount !== initialAmountStr
      || description !== (transaction?.description ?? '')
      || category !== initialCategory
      || date !== initialDate
      || isSettled !== initialSettled
    : amount.trim() !== '' || description.trim() !== '';

  const handleSave = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    // F1-K.1: payment_method se deriva del kind de la cuenta origen.
    const settledAt = isSettled ? date : null;
    const fromAccountId = isSettled ? accountId : null;
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
          status: isSettled ? 'completed' : 'pending',
          settled_at: settledAt,
          from_account_id: fromAccountId,
        });
        if (!ok) throw new Error('No se pudo actualizar el costo.');
      } else {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            business_id: businessId,
            type: 'expense',
            amount: amountNumber,
            date,
            payment_method: finalPaymentMethod,
            category,
            description: description || null,
            status: isSettled ? 'completed' : 'pending',
            settled_at: settledAt,
            from_account_id: fromAccountId,
          });
        if (insertError) throw insertError;
        // F1-N: solo creaciones (no edits). Sin monto en props — no PII.
        eventsRepo.track(businessId, 'transaction_created', {
          type: 'expense', category, settled: isSettled,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el costo.');
    } finally {
      setLoading(false);
    }
  };

  /** Eliminar — solo en modo edit. Confirmación cross-platform. */
  const handleDelete = () => {
    if (!isEdit || !transaction) return;
    confirmDestructive({
      title: '¿Eliminar este costo?',
      message: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setDeleting(true);
        setError('');
        const ok = await transactionsRepo.remove(transaction.id);
        setDeleting(false);
        if (ok) onSuccess();
        else setError('No se pudo eliminar el costo.');
      },
    });
  };

  return (
    <>
    <ModalShell visible onClose={onClose} dirty={dirty}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{isEdit ? 'Editar costo' : 'Nuevo costo'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          <Text style={styles.label}>Monto del costo *</Text>
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

          <Text style={styles.label}>Categoría</Text>
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

          {/* F1-J.5b: estado del pago */}
          <Text style={styles.label}>Estado del pago</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, isSettled && styles.chipActiveOrange]}
              onPress={() => setIsSettled(true)}
            >
              <Text style={[styles.chipText, isSettled && styles.chipTextActive]}>
                ✓ Ya pagué
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

          {/* F1-K.1: solo cuenta origen — payment_method se deriva del kind. */}
          {isSettled && accounts.length > 0 && (
            <>
              <Text style={styles.label}>¿De qué cuenta salió la plata?</Text>
              <View style={styles.chipsRow}>
                {accounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.chip, accountId === a.id && styles.chipActiveOrange]}
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
                ⏳ Este costo queda en "Por pagar". Vas a poder marcarlo como pagado
                cuando saldés, eligiendo de qué cuenta salió la plata.
              </Text>
            </View>
          )}

          {/* D-8: Fecha + Descripción comparten fila — uso horizontal de la
              pantalla y un bloque vertical menos. Descripción pasó a una
              línea (maxLength 120 se mantiene). */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldDate}>
              <Text style={styles.label}>Fecha</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#4A4A6A"
              />
            </View>
            <View style={styles.fieldDescription}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Descripción</Text>
                <Text style={styles.charCount}>{description.length}/120</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Ej: Harina, 50kg"
                placeholderTextColor="#4A4A6A"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />
            </View>
          </View>

          {/* Eliminar al final del contenido — destructivo, con fricción a propósito. */}
          {isEdit && (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#E74C3C" />
                : <Text style={styles.deleteBtnText}>Eliminar costo</Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>

        {/* D-8: footer FIJO fuera del scroll — el botón Guardar siempre visible,
            sin scrollear para encontrarlo. El error vive junto al botón. */}
        <View style={styles.footer}>
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
              : <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Guardar costo'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </ModalShell>

    {/* F1-L: modal de creación de categoría custom. Fuera del ModalShell para
        no anidar Modals. */}
    <AddCategoryModal
      visible={showAddCategory}
      businessId={businessId}
      type="expense"
      rubro={rubro}
      existingOverrides={overrides}
      onClose={() => setShowAddCategory(false)}
      onCreated={(created) => {
        setOverrides(prev => [...prev, created]);
        setCategory(created.value);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  // D-20.b — el overlay/backdrop ahora lo provee <ModalShell/> (#16).
  panel: {
    backgroundColor: '#12122A', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 18, paddingBottom: 0,
    maxHeight: '90%', borderTopWidth: 1, borderColor: '#B85C00',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  closeText: { color: '#7F8C8D', fontSize: 20 },
  label: { color: '#A0A0B8', fontSize: 12, marginBottom: 6, marginTop: 12 },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldDate: { flexBasis: '38%' },
  fieldDescription: { flex: 1 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 12,
    borderWidth: 1, borderColor: '#B85C00', paddingHorizontal: 14,
  },
  currency: { color: '#B85C00', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
  amountInput: {
    flex: 1, color: '#FFFFFF', fontSize: 26,
    fontWeight: 'bold', paddingVertical: 10,
  },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  charCount: { color: '#4A4A6A', fontSize: 10, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipActive: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  chipActiveOrange: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  /** F1-J.5b: estado "pendiente" — amarillo/ámbar, distinto del naranja "pagado". */
  chipActivePending: { backgroundColor: '#2B2200', borderColor: '#A67800' },
  /** F1-L: chip "+ Nueva categoría" — borde dashed teal. */
  chipAdd: { borderColor: '#1F8579', borderStyle: 'dashed' },
  chipAddText: { color: '#1F8579' },
  chipText: { color: '#7F8C8D', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  /** F1-J.5b: caja de ayuda contextual cuando el pago queda pendiente. */
  infoBox: {
    backgroundColor: '#1A1500', borderWidth: 1, borderColor: '#3A2E00',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  infoText: { color: '#D6BF66', fontSize: 12, lineHeight: 17 },
  /** D-8: footer fijo — separado del scroll, el botón nunca queda fuera de vista. */
  footer: {
    paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: '#1C1C30',
  },
  saveBtn: {
    backgroundColor: '#B85C00', paddingVertical: 13,
    borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#2B1A00', opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  deleteBtn: {
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    marginTop: 14, marginBottom: 4,
    borderWidth: 1, borderColor: '#7A241C', backgroundColor: 'rgba(192,57,43,0.08)',
  },
  deleteBtnText: { color: '#E74C3C', fontSize: 13, fontWeight: '600' },
});
