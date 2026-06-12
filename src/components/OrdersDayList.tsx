/**
 * OrdersDayList — agenda de pedidos de un día (F1-O Etapa 2B / D-21.a).
 *
 * Se abre al tocar un día con marca de pedidos en el calendario (hoy o
 * futuro). Lista los pedidos de esa fecha y ofrece LA acción del flujo:
 * "Entregar" → pregunta "¿Te pagaron?" →
 *   - Sí, cobré   → elegir cuenta → venta settled (plata en cuenta)
 *   - Todavía no  → venta con settled_at NULL → cae a Por Cobrar (F1-J)
 *
 * La conversión es la RPC atómica deliver_order (vía ordersRepo.deliver) —
 * doble tap o dos devices producen UNA sola venta; acá solo se pinta el
 * resultado. Tap en el cuerpo de un pedido pending → edición (OrderForm).
 *
 * Optimistic-honesto (objetivo gráfico #4 de D-22): guardar/entregar nunca
 * espera a nada externo; el estado que se muestra es el que confirmó la DB.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ordersRepo } from '../repos/orders';
import { accountsRepo } from '../repos/accounts';
import { todayLocalISO, parseLocalISODate } from '../utils/periods';
import { formatMoney } from './Money';
import type { Order } from '../schemas/order';
import type { Account } from '../schemas/account';
import { color as token } from '../design';

type Props = {
  businessId: string;
  /** 'YYYY-MM-DD' del día cuya agenda se muestra. */
  dateISO: string;
  onClose: () => void;
  /** Tap en un pedido pending → el padre abre OrderForm en modo edit. */
  onEditOrder: (order: Order) => void;
};

/** "viernes 15 de junio" con primera mayúscula. */
function dayLabel(iso: string): string {
  const raw = parseLocalISODate(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Pendiente',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function OrdersDayList({ businessId, dateISO, onClose, onEditOrder }: Props) {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  /** Pedido con el panel "¿Te pagaron?" abierto. */
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [paid, setPaid]           = useState<boolean | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    const [list, accs] = await Promise.all([
      ordersRepo.listByDay(businessId, dateISO),
      accountsRepo.listActive(businessId),
    ]);
    setOrders(list);
    setAccounts(accs);
    setLoading(false);
  }, [businessId, dateISO]);

  useEffect(() => { load(); }, [load]);

  const openDeliverPanel = (order: Order) => {
    setDeliveringId(order.id);
    setPaid(null);
    setAccountId(accounts.find(a => a.is_default)?.id ?? accounts[0]?.id ?? null);
    setError('');
  };

  const canConfirm = paid != null && (!paid || accountId != null) && !busy;

  const handleConfirmDeliver = async (order: Order) => {
    if (!canConfirm || paid == null) return;
    setBusy(true);
    setError('');
    const result = await ordersRepo.deliver(order.id, businessId, {
      paid,
      accountId: paid ? accountId ?? undefined : undefined,
      deliveredOn: todayLocalISO(),
    });
    setBusy(false);
    if (result.ok) {
      setDeliveringId(null);
      await load();  // el estado mostrado es el que confirmó la DB
    } else {
      setError(result.message);
      if (result.code === 'not_pending') await load();
    }
  };

  const pendings = orders.filter(o => o.status === 'pending');
  const committedTotal = pendings.reduce((sum, o) => sum + o.amount, 0);

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>

        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Pedidos</Text>
            <Text style={styles.panelSub}>{dayLabel(dateISO)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {pendings.length > 0 && (
          <Text style={styles.committedLine}>
            {pendings.length === 1 ? '1 entrega' : `${pendings.length} entregas`} · $ {formatMoney(committedTotal)} comprometidos
          </Text>
        )}

        <ScrollView showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={token.accent.base} style={{ marginVertical: 24 }} />
          ) : orders.length === 0 ? (
            <Text style={styles.emptyText}>No hay pedidos para este día.</Text>
          ) : (
            orders.map(order => {
              const isPending = order.status === 'pending';
              const isOpen = deliveringId === order.id;
              return (
                <View key={order.id} style={[styles.orderCard, !isPending && { opacity: 0.55 }]}>
                  <TouchableOpacity
                    style={styles.orderRow}
                    onPress={isPending ? () => onEditOrder(order) : undefined}
                    activeOpacity={isPending ? 0.7 : 1}
                    disabled={!isPending}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderClient}>{order.client_name}</Text>
                      <Text style={styles.orderDesc} numberOfLines={1}>{order.description}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.orderAmount}>$ {formatMoney(order.amount)}</Text>
                      {!isPending && (
                        <View style={[
                          styles.statusChip,
                          order.status === 'delivered' ? styles.statusDelivered : styles.statusCancelled,
                        ]}>
                          <Text style={[
                            styles.statusChipText,
                            { color: order.status === 'delivered' ? token.success.base : token.text.tertiary },
                          ]}>
                            {STATUS_LABEL[order.status]}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {isPending && !isOpen && (
                    <TouchableOpacity
                      style={styles.deliverBtn}
                      onPress={() => openDeliverPanel(order)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.deliverBtnText}>Entregar</Text>
                    </TouchableOpacity>
                  )}

                  {isPending && isOpen && (
                    <View style={styles.deliverPanel}>
                      <Text style={styles.deliverQuestion}>¿Te pagaron?</Text>
                      <View style={styles.chipsRow}>
                        <TouchableOpacity
                          style={[styles.chip, paid === true && styles.chipActiveGreen]}
                          onPress={() => setPaid(true)}
                        >
                          <Text style={[styles.chipText, paid === true && styles.chipTextActive]}>
                            ✓ Sí, cobré
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chip, paid === false && styles.chipActivePending]}
                          onPress={() => setPaid(false)}
                        >
                          <Text style={[styles.chipText, paid === false && styles.chipTextActive]}>
                            ⏳ Todavía no
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {paid === true && accounts.length > 0 && (
                        <>
                          <Text style={styles.deliverSubLabel}>¿Dónde entró la plata?</Text>
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

                      {paid === false && (
                        <Text style={styles.pendingNote}>
                          La venta queda en "Por Cobrar" — la marcás cobrada cuando entre la plata.
                        </Text>
                      )}

                      {error.length > 0 && deliveringId === order.id && (
                        <Text style={styles.errorText}>⚠️ {error}</Text>
                      )}

                      <View style={styles.deliverActions}>
                        <TouchableOpacity
                          style={styles.deliverCancel}
                          onPress={() => { setDeliveringId(null); setError(''); }}
                        >
                          <Text style={styles.deliverCancelText}>Volver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.deliverConfirm, !canConfirm && styles.deliverConfirmDisabled]}
                          onPress={() => handleConfirmDeliver(order)}
                          disabled={!canConfirm}
                        >
                          {busy
                            ? <ActivityIndicator color="#FFFFFF" size="small" />
                            : <Text style={styles.deliverConfirmText}>Confirmar entrega</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 16 }} />
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
    borderTopRightRadius: 24, padding: 18,
    maxHeight: '85%', borderTopWidth: 1, borderColor: '#1F8579',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  panelSub:   { color: '#7F8C8D', fontSize: 12, marginTop: 2 },
  closeBtn:   { padding: 8 },
  closeText:  { color: '#7F8C8D', fontSize: 20 },
  committedLine: { color: '#5FBDB0', fontSize: 12, marginBottom: 10 },
  emptyText: {
    color: '#7F8C8D', fontSize: 13, fontStyle: 'italic',
    textAlign: 'center', marginVertical: 24,
  },

  orderCard: {
    backgroundColor: '#141422', borderRadius: 12,
    borderWidth: 1, borderColor: '#1C1C30',
    padding: 12, marginBottom: 8,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderClient: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  orderDesc:   { color: '#7F8C8D', fontSize: 12, marginTop: 2 },
  orderAmount: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  statusChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    borderWidth: 1,
  },
  statusDelivered: { borderColor: '#1A6B3A', backgroundColor: '#0D2B1A' },
  statusCancelled: { borderColor: '#2A2A4A', backgroundColor: 'transparent' },
  statusChipText:  { fontSize: 10, fontWeight: '600' },

  deliverBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#1A6B3A', borderRadius: 10,
    paddingVertical: 9, marginTop: 10,
  },
  deliverBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  deliverPanel: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#1C1C30',
  },
  deliverQuestion: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  deliverSubLabel: { color: '#A0A0B8', fontSize: 12, marginTop: 10, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4A',
  },
  chipActiveGreen:   { backgroundColor: '#0D2B1A', borderColor: '#1A6B3A' },
  chipActivePending: { backgroundColor: '#2B2200', borderColor: '#A67800' },
  chipText:       { color: '#7F8C8D', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  pendingNote: {
    color: '#D6BF66', fontSize: 12, lineHeight: 17, marginTop: 10,
  },
  errorText: { color: '#E74C3C', fontSize: 12, marginTop: 10 },

  deliverActions: {
    flexDirection: 'row', gap: 10, marginTop: 12,
  },
  deliverCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  deliverCancelText: { color: '#7F8C8D', fontSize: 13 },
  deliverConfirm: {
    flex: 2, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1A6B3A',
  },
  deliverConfirmDisabled: { backgroundColor: '#0D2B1A', opacity: 0.6 },
  deliverConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
