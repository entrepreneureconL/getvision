/**
 * MovementForm — F1-J.5c refactor completo.
 *
 * 4 tabs:
 *   - Pendientes:   lista de transactions con settled_at IS NULL. Cada item
 *                   tiene chips de cuenta y botón para saldarla (transactionsRepo.settle).
 *   - Aporte:       owner_in — plata del dueño que ENTRA a una cuenta del negocio.
 *                   type='income_extraordinary', category='owner_in', to_account_id.
 *   - Retiro:       owner_out — plata del dueño que SALE de una cuenta del negocio.
 *                   type='expense_extraordinary', category='owner_out', from_account_id.
 *   - Transferencia: mover plata entre cuentas propias. Una sola fila con
 *                   from_account_id + to_account_id. type='income_extraordinary' por
 *                   convención (aggregate ignora extraordinarios). category='transfer'.
 *
 * Cero efecto en KPIs operativos: los 3 subtipos usan type *_extraordinary, que
 * aggregate() en transactionsRepo ignora del balance del período. Solo afectan
 * los balances de cuenta (stock).
 *
 * Arregla bug del master §7: ahora se guarda con type correcto y category fina,
 * en lugar de type='income/expense' + category libre.
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { supabase } from '../lib/supabase';
import { transactionsRepo } from '../repos/transactions';
import { accountsRepo } from '../repos/accounts';
import { resolveCategory } from '../utils/transactionCategories';
import { todayLocalISO } from '../utils/periods';
import type { Account } from '../schemas/account';
import type { Transaction } from '../schemas/transaction';

const { width } = Dimensions.get('window');
const FORM_WIDTH = Math.min(400, width - 48);

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
};

const TABS = ['Pendientes', 'Aporte', 'Retiro', 'Transfer.'] as const;
type Tab = typeof TABS[number];

export default function MovementForm({ businessId, onSuccess, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Pendientes');

  // Cuentas activas del business — fuente para todos los pickers.
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);

  // Pendientes (carga inicial + recarga después de settle).
  const [receivables, setReceivables] = useState<Transaction[]>([]);
  const [payables, setPayables] = useState<Transaction[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Estado común a los 3 tabs de carga.
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayLocalISO());
  // Tabs Aporte/Retiro: cuenta única.
  const [singleAccountId, setSingleAccountId] = useState<string | null>(null);
  // Tab Transferencia: desde/hacia.
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // F1-J.5c: trackear si hubo settles en Pendientes (para refrescar dashboard
  // al cerrar). Las otras 3 tabs llaman onSuccess() en cada save y cierran solas.
  const [pendingChanged, setPendingChanged] = useState(false);

  /** Handler unificado del botón ✕ y del callback onClose. */
  const handleClose = () => {
    if (pendingChanged) onSuccess();  // refresca dashboard si saldé algo
    else onClose();
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [accs, pending] = await Promise.all([
        accountsRepo.listActive(businessId),
        transactionsRepo.listPending(businessId),
      ]);
      if (!active) return;
      setAccounts(accs);
      const def = accs.find(a => a.is_default) ?? accs[0];
      if (def) {
        setDefaultAccountId(def.id);
        setSingleAccountId(def.id);
        setFromAccountId(def.id);
      }
      setReceivables(pending.receivables);
      setPayables(pending.payables);
      setLoadingPending(false);
    })();
    return () => { active = false; };
  }, [businessId]);

  const reloadPending = async () => {
    const pending = await transactionsRepo.listPending(businessId);
    setReceivables(pending.receivables);
    setPayables(pending.payables);
  };

  const amountNumber = parseFloat(amount.replace(',', '.'));
  const baseCanSubmit = !isNaN(amountNumber) && amountNumber > 0 && !loading;

  // Reseteo de form después de guardar exitoso.
  const resetForm = () => {
    setAmount('');
    setDescription('');
    setError('');
  };

  // ─── Aporte ───
  const handleSaveAporte = async () => {
    if (!baseCanSubmit || !singleAccountId) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('transactions').insert({
        business_id: businessId,
        type: 'income_extraordinary',
        amount: amountNumber,
        date,
        category: 'owner_in',
        description: description || null,
        status: 'completed',
        settled_at: date,
        to_account_id: singleAccountId,
      });
      if (err) throw err;
      resetForm();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el aporte.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Retiro ───
  const handleSaveRetiro = async () => {
    if (!baseCanSubmit || !singleAccountId) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('transactions').insert({
        business_id: businessId,
        type: 'expense_extraordinary',
        amount: amountNumber,
        date,
        category: 'owner_out',
        description: description || null,
        status: 'completed',
        settled_at: date,
        from_account_id: singleAccountId,
      });
      if (err) throw err;
      resetForm();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el retiro.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Transferencia ───
  const handleSaveTransfer = async () => {
    if (!baseCanSubmit || !fromAccountId || !toAccountId) return;
    if (fromAccountId === toAccountId) {
      setError('Las cuentas de origen y destino deben ser distintas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Una sola fila — getBalances lee from/to en simultáneo: −amount al
      // from y +amount al to. Atómico.
      const { error: err } = await supabase.from('transactions').insert({
        business_id: businessId,
        type: 'income_extraordinary',  // convención; aggregate ignora *_extraordinary
        amount: amountNumber,
        date,
        category: 'transfer',
        description: description || null,
        status: 'completed',
        settled_at: date,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
      });
      if (err) throw err;
      resetForm();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la transferencia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>

        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>↔️ Movimientos</Text>
          <TouchableOpacity onPress={handleClose}>
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
            <PendingTab
              loading={loadingPending}
              receivables={receivables}
              payables={payables}
              accounts={accounts}
              defaultAccountId={defaultAccountId}
              onSettle={async () => {
                await reloadPending();
                setPendingChanged(true);
                // NO llamamos onSuccess acá: el modal queda abierto para que
                // el usuario pueda saldar varios pendientes en serie. Al cerrar
                // el ✕, handleClose() refresca el dashboard si hubo cambios.
              }}
            />
          )}

          {/* TAB: Aporte del dueño (owner_in) */}
          {activeTab === 'Aporte' && (
            <>
              <Text style={styles.tabDescription}>
                ➕ Plata que vos ponés en el negocio. No cuenta como ingreso operativo,
                pero suma a la cuenta destino.
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

              <Text style={styles.label}>Concepto (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Aporte mensual, capital de trabajo..."
                placeholderTextColor="#4A4A6A"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />

              <Text style={styles.label}>¿A qué cuenta entra?</Text>
              <AccountChips
                accounts={accounts}
                selectedId={singleAccountId}
                onSelect={setSingleAccountId}
                tint="green"
              />

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
                style={[
                  styles.saveBtn, { backgroundColor: '#1A6B3A' },
                  (!baseCanSubmit || !singleAccountId) && styles.saveBtnDisabled,
                ]}
                onPress={handleSaveAporte}
                disabled={!baseCanSubmit || !singleAccountId}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Guardar aporte</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* TAB: Retiro del dueño (owner_out) */}
          {activeTab === 'Retiro' && (
            <>
              <Text style={styles.tabDescription}>
                ➖ Plata que sacás del negocio para vos. No cuenta como gasto
                operativo, pero resta a la cuenta de origen.
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

              <Text style={styles.label}>Concepto (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Sueldo, retiro personal..."
                placeholderTextColor="#4A4A6A"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
              />

              <Text style={styles.label}>¿De qué cuenta sale?</Text>
              <AccountChips
                accounts={accounts}
                selectedId={singleAccountId}
                onSelect={setSingleAccountId}
                tint="orange"
              />

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
                style={[
                  styles.saveBtn, { backgroundColor: '#B85C00' },
                  (!baseCanSubmit || !singleAccountId) && styles.saveBtnDisabled,
                ]}
                onPress={handleSaveRetiro}
                disabled={!baseCanSubmit || !singleAccountId}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Guardar retiro</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* TAB: Transferencia entre cuentas */}
          {activeTab === 'Transfer.' && (
            <>
              <Text style={styles.tabDescription}>
                🔁 Mover plata entre tus cuentas (ej. de Efectivo a Banco). No
                afecta el resultado del mes; solo cambia dónde está la plata.
              </Text>

              {accounts.length < 2 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Necesitás al menos 2 cuentas para hacer una transferencia.
                    Vas a poder configurar más cuentas en Ajustes (próximamente).
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Monto *</Text>
                  <View style={styles.amountRow}>
                    <Text style={[styles.currency, { color: '#7d4ec6' }]}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor="#4A4A6A"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <Text style={styles.label}>Desde</Text>
                  <AccountChips
                    accounts={accounts}
                    selectedId={fromAccountId}
                    onSelect={setFromAccountId}
                    tint="purple"
                  />

                  <Text style={styles.label}>Hacia</Text>
                  <AccountChips
                    accounts={accounts.filter(a => a.id !== fromAccountId)}
                    selectedId={toAccountId}
                    onSelect={setToAccountId}
                    tint="purple"
                  />

                  <Text style={styles.label}>Concepto (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Pasaje a banco, retiro de ATM..."
                    placeholderTextColor="#4A4A6A"
                    value={description}
                    onChangeText={setDescription}
                    maxLength={120}
                  />

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
                    style={[
                      styles.saveBtn, { backgroundColor: '#7d4ec6' },
                      (!baseCanSubmit || !fromAccountId || !toAccountId || fromAccountId === toAccountId)
                        && styles.saveBtnDisabled,
                    ]}
                    onPress={handleSaveTransfer}
                    disabled={
                      !baseCanSubmit || !fromAccountId || !toAccountId
                      || fromAccountId === toAccountId
                    }
                  >
                    {loading
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.saveBtnText}>Guardar transferencia</Text>}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

        </ScrollView>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────

/**
 * Chips de selección de cuenta. Reutilizado en 3 tabs (Aporte, Retiro,
 * Transferencia tanto from como to). Tint cambia el color del estado activo.
 */
function AccountChips({
  accounts, selectedId, onSelect, tint,
}: {
  accounts: Account[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  tint: 'green' | 'orange' | 'purple';
}) {
  const activeStyle =
    tint === 'green'  ? styles.chipActiveGreen  :
    tint === 'orange' ? styles.chipActiveOrange :
                        styles.chipActivePurple ;

  if (accounts.length === 0) {
    return <Text style={styles.placeholderText}>Cargando cuentas...</Text>;
  }
  return (
    <View style={styles.chipsRow}>
      {accounts.map(a => (
        <TouchableOpacity
          key={a.id}
          style={[styles.chip, selectedId === a.id && activeStyle]}
          onPress={() => onSelect(a.id)}
        >
          <Text style={[styles.chipText, selectedId === a.id && styles.chipTextActive]}>
            {a.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Tab Pendientes: lista de receivables + payables. Cada item tiene su propio
 * selector de cuenta (default = is_default del business) y botón para saldar.
 */
function PendingTab({
  loading, receivables, payables, accounts, defaultAccountId, onSettle,
}: {
  loading: boolean;
  receivables: Transaction[];
  payables: Transaction[];
  accounts: Account[];
  defaultAccountId: string | null;
  onSettle: () => void;
}) {
  if (loading) {
    return <ActivityIndicator color="#4A2080" style={{ marginTop: 40 }} />;
  }
  if (receivables.length === 0 && payables.length === 0) {
    return (
      <View style={styles.emptyPending}>
        <Text style={styles.emptyIcon}>🎉</Text>
        <Text style={styles.emptyText}>No tenés cobros ni pagos pendientes.</Text>
        <Text style={styles.emptySubtext}>¡Todo al día!</Text>
      </View>
    );
  }
  return (
    <>
      {receivables.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>💰 Por cobrar ({receivables.length})</Text>
          {receivables.map(t => (
            <PendingRow
              key={t.id}
              transaction={t}
              accounts={accounts}
              defaultAccountId={defaultAccountId}
              onSettled={onSettle}
            />
          ))}
        </>
      )}
      {payables.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>📋 Por pagar ({payables.length})</Text>
          {payables.map(t => (
            <PendingRow
              key={t.id}
              transaction={t}
              accounts={accounts}
              defaultAccountId={defaultAccountId}
              onSettled={onSettle}
            />
          ))}
        </>
      )}
    </>
  );
}

function PendingRow({
  transaction, accounts, defaultAccountId, onSettled,
}: {
  transaction: Transaction;
  accounts: Account[];
  defaultAccountId: string | null;
  onSettled: () => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(defaultAccountId);
  const [settling, setSettling] = useState(false);

  const isIncome = transaction.type === 'income' || transaction.type === 'income_extraordinary';
  const cat = resolveCategory(transaction.category);
  const catLabel = cat?.label ?? transaction.category ?? '(Sin categoría)';

  const handleSettle = async () => {
    if (!selectedAccountId) return;
    setSettling(true);
    const today = todayLocalISO();
    const ok = await transactionsRepo.settle(
      transaction.id, transaction.type, selectedAccountId, today,
    );
    setSettling(false);
    if (ok) onSettled();
  };

  return (
    <View style={styles.pendingItem}>
      <View style={styles.pendingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pendingCategory}>
            {cat?.icon ?? (isIncome ? '💰' : '📋')}  {catLabel}
          </Text>
          {transaction.description ? (
            <Text style={styles.pendingDesc}>{transaction.description}</Text>
          ) : null}
          <Text style={styles.pendingDate}>{transaction.date}</Text>
        </View>
        <Text style={[
          styles.pendingAmount,
          { color: isIncome ? '#1A6B3A' : '#B85C00' },
        ]}>
          {isIncome ? '+' : '−'} $ {Number(transaction.amount).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>

      <Text style={styles.pendingSubLabel}>
        {isIncome ? '¿Dónde entró la plata?' : '¿De qué cuenta salió?'}
      </Text>
      <View style={styles.chipsRow}>
        {accounts.map(a => (
          <TouchableOpacity
            key={a.id}
            style={[
              styles.chipSmall,
              selectedAccountId === a.id && (isIncome ? styles.chipActiveGreen : styles.chipActiveOrange),
            ]}
            onPress={() => setSelectedAccountId(a.id)}
          >
            <Text style={[styles.chipTextSmall,
              selectedAccountId === a.id && styles.chipTextActive]}>
              {a.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.settleBtn,
          { backgroundColor: isIncome ? '#0D2B1A' : '#2B1A00' },
          (!selectedAccountId || settling) && styles.saveBtnDisabled,
        ]}
        disabled={!selectedAccountId || settling}
        onPress={handleSettle}
      >
        {settling
          ? <ActivityIndicator color={isIncome ? '#1A6B3A' : '#B85C00'} />
          : (
            <Text style={[
              styles.settleBtnText,
              { color: isIncome ? '#1A6B3A' : '#B85C00' },
            ]}>
              {isIncome ? '✓ Marcar cobrado' : '✓ Marcar pagado'}
            </Text>
          )}
      </TouchableOpacity>
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
  tabText: { color: '#7F8C8D', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabDescription: {
    color: '#7F8C8D', fontSize: 13, marginBottom: 16,
    lineHeight: 18, fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#A0A0B8', fontSize: 12, fontWeight: '600',
    marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  emptyPending: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#7F8C8D', fontSize: 15, marginBottom: 4 },
  emptySubtext: { color: '#4A4A6A', fontSize: 13 },

  pendingItem: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#2A2A4A',
  },
  pendingHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12, gap: 12,
  },
  pendingCategory: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pendingDesc: { color: '#7F8C8D', fontSize: 12, marginTop: 2 },
  pendingDate: { color: '#4A4A6A', fontSize: 11, marginTop: 2 },
  pendingAmount: { fontSize: 15, fontWeight: 'bold' },
  pendingSubLabel: { color: '#A0A0B8', fontSize: 11, marginBottom: 6 },
  settleBtn: {
    paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  settleBtnText: { fontSize: 13, fontWeight: '600' },

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
  chipSmall: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#0F0F1A', borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipActiveGreen:  { backgroundColor: '#0D2B1A', borderColor: '#1A6B3A' },
  chipActiveOrange: { backgroundColor: '#2B1A00', borderColor: '#B85C00' },
  chipActivePurple: { backgroundColor: '#2A1740', borderColor: '#7d4ec6' },
  chipText:     { color: '#7F8C8D', fontSize: 13 },
  chipTextSmall:{ color: '#7F8C8D', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF' },
  placeholderText: { color: '#4A4A6A', fontSize: 13, fontStyle: 'italic' },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 12, marginTop: 16,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  infoBox: {
    backgroundColor: '#1A1500', borderWidth: 1, borderColor: '#3A2E00',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  infoText: { color: '#D6BF66', fontSize: 12, lineHeight: 17 },
  saveBtn: {
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24, marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
