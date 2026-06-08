import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions, FlatList
} from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const FORM_WIDTH = Math.min(400, width - 48);

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
};

type Pending = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  date: string;
  category: string;
};

const TABS = ['Pendientes', 'Ingreso extra', 'Gasto extra'] as const;
type Tab = typeof TABS[number];

export default function MovementForm({ businessId, onSuccess, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Pendientes');
  const [pendingItems, setPendingItems] = useState<Pending[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadPending(); }, []);

  const loadPending = async () => {
    setLoadingPending(true);
    const { data } = await supabase
      .from('transactions')
      .select('id, type, amount, description, date, category')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .order('date', { ascending: true });
    if (data) setPendingItems(data);
    setLoadingPending(false);
  };

  const markAsDone = async (id: string) => {
    await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .eq('id', id);
    loadPending();
    onSuccess();
  };

  const amountNumber = parseFloat(amount.replace(',', '.'));
  const canSubmit = !isNaN(amountNumber) && amountNumber > 0 && !loading;

  const handleSaveExtra = async (type: 'income' | 'expense') => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          business_id: businessId,
          type,
          amount: amountNumber,
          date,
          payment_method: paymentMethod,
          category: type === 'income' ? 'Ingreso extraordinario' : 'Gasto extraordinario',
          description: description || null,
          status: 'completed',
        });
      if (insertError) throw insertError;
      setAmount('');
      setDescription('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_METHODS = [
    { key: 'cash', label: '💵 Efectivo' },
    { key: 'transfer', label: '🔵 Transferencia' },
    { key: 'other', label: '📋 Otro' },
  ];

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>

        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>↔️ Movimientos</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); setError(''); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* TAB: Pendientes */}
          {activeTab === 'Pendientes' && (
            <>
              {loadingPending ? (
                <ActivityIndicator color="#4A2080" style={{ marginTop: 40 }} />
              ) : pendingItems.length === 0 ? (
                <View style={styles.emptyPending}>
                  <Text style={styles.emptyIcon}>🎉</Text>
                  <Text style={styles.emptyText}>
                    No tenés cobros ni pagos pendientes.
                  </Text>
                  <Text style={styles.emptySubtext}>¡Todo al día!</Text>
                </View>
              ) : (
                pendingItems.map(item => (
                  <View key={item.id} style={styles.pendingItem}>
                    <View style={styles.pendingLeft}>
                      <Text style={styles.pendingIcon}>
                        {item.type === 'income' ? '💰' : '📋'}
                      </Text>
                      <View>
                        <Text style={styles.pendingCategory}>{item.category}</Text>
                        <Text style={styles.pendingDesc}>
                          {item.description || 'Sin descripción'}
                        </Text>
                        <Text style={styles.pendingDate}>{item.date}</Text>
                      </View>
                    </View>
                    <View style={styles.pendingRight}>
                      <Text style={[styles.pendingAmount,
                        { color: item.type === 'income' ? '#1A6B3A' : '#B85C00' }]}>
                        $ {Number(item.amount).toLocaleString('es-AR')}
                      </Text>
                      <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => markAsDone(item.id)}
                      >
                        <Text style={styles.doneBtnText}>
                          {item.type === 'income' ? '✓ Cobrado' : '✓ Pagado'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* TAB: Ingreso extra */}
          {activeTab === 'Ingreso extra' && (
            <>
              <Text style={styles.tabDescription}>
                Ingresos que no son ventas: préstamos recibidos, reintegros, subsidios.
              </Text>

              <Text style={styles.label}>Monto *</Text>
              <View style={styles.amountRow}>
                <Text style={[styles.currency, { color: '#1A6B3A' }]}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#4A4A6A"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.label}>Concepto *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Préstamo recibido, reintegro..."
                placeholderTextColor="#4A4A6A"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />

              <Text style={styles.label}>Forma de cobro</Text>
              <View style={styles.chipsRow}>
                {PAYMENT_METHODS.map(pm => (
                  <TouchableOpacity
                    key={pm.key}
                    style={[styles.chip,
                      paymentMethod === pm.key && styles.chipActiveGreen]}
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

              {error.length > 0 && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#1A6B3A' },
                  !canSubmit && styles.saveBtnDisabled]}
                onPress={() => handleSaveExtra('income')}
                disabled={!canSubmit}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Guardar ingreso</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* TAB: Gasto extra */}
          {activeTab === 'Gasto extra' && (
            <>
              <Text style={styles.tabDescription}>
                Gastos que no son costos del negocio: multas, devoluciones, gastos personales.
              </Text>

              <Text style={styles.label}>Monto *</Text>
              <View style={styles.amountRow}>
                <Text style={[styles.currency, { color: '#B85C00' }]}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#4A4A6A"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.label}>Concepto *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Multa, devolución a cliente..."
                placeholderTextColor="#4A4A6A"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />

              <Text style={styles.label}>Forma de pago</Text>
              <View style={styles.chipsRow}>
                {PAYMENT_METHODS.map(pm => (
                  <TouchableOpacity
                    key={pm.key}
                    style={[styles.chip,
                      paymentMethod === pm.key && styles.chipActiveOrange]}
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

              {error.length > 0 && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#B85C00' },
                  !canSubmit && styles.saveBtnDisabled]}
                onPress={() => handleSaveExtra('expense')}
                disabled={!canSubmit}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Guardar gasto</Text>
                }
              </TouchableOpacity>
            </>
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
    borderTopWidth: 1, borderColor: '#4A2080',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  closeText: { color: '#7F8C8D', fontSize: 20 },
  tabsRow: {
    flexDirection: 'row', backgroundColor: '#1A1A2E',
    borderRadius: 10, padding: 4, marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#4A2080' },
  tabText: { color: '#7F8C8D', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabDescription: {
    color: '#7F8C8D', fontSize: 13, marginBottom: 16,
    lineHeight: 18, fontStyle: 'italic',
  },
  emptyPending: {
    alignItems: 'center', paddingVertical: 48,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#7F8C8D', fontSize: 15, marginBottom: 4 },
  emptySubtext: { color: '#4A4A6A', fontSize: 13 },
  pendingItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#1A1A2E',
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  pendingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pendingIcon: { fontSize: 24 },
  pendingCategory: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pendingDesc: { color: '#7F8C8D', fontSize: 12 },
  pendingDate: { color: '#4A4A6A', fontSize: 11, marginTop: 2 },
  pendingRight: { alignItems: 'flex-end', gap: 6 },
  pendingAmount: { fontSize: 15, fontWeight: 'bold' },
  doneBtn: {
    backgroundColor: '#0D2B1A', borderWidth: 1, borderColor: '#1A6B3A',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  doneBtnText: { color: '#1A6B3A', fontSize: 12, fontWeight: '600' },
  label: { color: '#A0A0B8', fontSize: 13, marginBottom: 8, marginTop: 16 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A4A', paddingHorizontal: 16,
  },
  currency: { fontSize: 24, fontWeight: 'bold', marginRight: 8 },
  amountInput: {
    flex: 1, color: '#FFFFFF', fontSize: 32,
    fontWeight: 'bold', paddingVertical: 16,
  },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipActiveGreen: { backgroundColor: '#0D2B1A', borderColor: '#1A6B3A' },
  chipActiveOrange: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  chipText: { color: '#7F8C8D', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 12, marginTop: 16,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  saveBtn: {
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24, marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});