import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  getCategoriesForType,
  PAYMENT_METHODS as PM_CATALOG,
  resolveCategory,
} from '../utils/transactionCategories';
import { transactionsRepo } from '../repos/transactions';
import type { Transaction } from '../schemas/transaction';

const { width } = Dimensions.get('window');
const FORM_WIDTH = Math.min(400, width - 48);

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
  /** Si está presente, el form trabaja en modo edición. F1-D Task #11. */
  transaction?: Transaction;
};

const PAYMENT_METHODS = PM_CATALOG
  .filter(m => ['cash', 'transfer', 'credit', 'pending'].includes(m.value))
  .map(m => ({
    key: m.value,
    label: `${m.icon} ${m.value === 'pending' ? 'A pagar' : m.label}`,
  }));

const CATEGORIES = getCategoriesForType('expense');

export default function CostForm({ businessId, onSuccess, onClose, transaction }: Props) {
  const isEdit = !!transaction;

  const initialCategory = transaction?.category
    ? (resolveCategory(transaction.category)?.value ?? CATEGORIES[0]?.value ?? 'supplies')
    : (CATEGORIES[0]?.value ?? 'supplies');

  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount).replace('.', ',') : '',
  );
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(transaction?.payment_method ?? 'cash');
  const [category, setCategory] = useState<string>(initialCategory);
  const [date, setDate] = useState(
    transaction?.date ?? new Date().toISOString().split('T')[0],
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const amountNumber = parseFloat(amount.replace(',', '.'));
  const canSubmit = !isNaN(amountNumber) && amountNumber > 0 && !loading;

  const handleSave = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      if (isEdit && transaction) {
        const ok = await transactionsRepo.update(transaction.id, {
          amount: amountNumber,
          date,
          payment_method: paymentMethod,
          category,
          description: description || null,
          status: paymentMethod === 'pending' ? 'pending' : 'completed',
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
            payment_method: paymentMethod,
            category,
            description: description || null,
            status: paymentMethod === 'pending' ? 'pending' : 'completed',
          });
        if (insertError) throw insertError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el costo.');
    } finally {
      setLoading(false);
    }
  };

  /** Eliminar — solo en modo edit. */
  const handleDelete = () => {
    if (!isEdit || !transaction) return;
    Alert.alert(
      '¿Eliminar este costo?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError('');
            const ok = await transactionsRepo.remove(transaction.id);
            setDeleting(false);
            if (ok) onSuccess();
            else setError('No se pudo eliminar el costo.');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{isEdit ? '✏️ Editar costo' : '🛒 Nuevo Costo'}</Text>
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
            {CATEGORIES.map(cat => (
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
          </View>

          <Text style={styles.label}>Forma de pago</Text>
          <View style={styles.chipsRow}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity
                key={pm.key}
                style={[styles.chip, paymentMethod === pm.key && styles.chipActiveOrange]}
                onPress={() => setPaymentMethod(pm.key)}
              >
                <Text style={[styles.chipText,
                  paymentMethod === pm.key && styles.chipTextActive]}>
                  {pm.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
            placeholder="Ej: Compra de harina, 50kg..."
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
              : <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Guardar costo'}</Text>
            }
          </TouchableOpacity>

          {isEdit && (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#E74C3C" />
                : <Text style={styles.deleteBtnText}>🗑 Eliminar costo</Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>
      </View>
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
    borderTopRightRadius: 24, padding: 24, maxHeight: '90%',
    borderTopWidth: 1, borderColor: '#B85C00',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  closeText: { color: '#7F8C8D', fontSize: 20 },
  label: { color: '#A0A0B8', fontSize: 13, marginBottom: 8, marginTop: 16 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 12,
    borderWidth: 1, borderColor: '#B85C00', paddingHorizontal: 16,
  },
  currency: { color: '#B85C00', fontSize: 24, fontWeight: 'bold', marginRight: 8 },
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
  chipActive: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  chipActiveOrange: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  chipText: { color: '#7F8C8D', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 12, marginTop: 16,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#B85C00', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 24, marginBottom: 8,
  },
  saveBtnDisabled: { backgroundColor: '#2B1A00', opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    marginTop: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#7A241C', backgroundColor: 'rgba(192,57,43,0.08)',
  },
  deleteBtnText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});