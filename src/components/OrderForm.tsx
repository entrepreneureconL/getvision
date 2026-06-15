/**
 * OrderForm — carga y edición de pedidos de clientes (F1-O Etapa 2B / D-21.a).
 *
 * Alcance v1 mínimo decidido por el CEO (ADR #30): cliente, descripción,
 * monto, fecha de entrega. Un pedido NO es una venta — acá no hay estado de
 * cobro ni cuenta: la plata recién se mueve al ENTREGAR (OrdersDayList).
 *
 * Modo edit: tap en un pedido pending desde la lista del día. Solo los
 * pending se editan (guard en el repo — un pedido entregado/cancelado
 * devuelve error visible, no éxito silencioso). "Cancelar pedido" es la
 * acción destructiva del form (estado terminal, sin venta).
 *
 * Patrón visual: espejo de SaleForm (overlay + panel bottom-sheet + footer
 * fijo con Guardar). Deuda compartida de StyleSheet legacy declarada en
 * MASTER — el rewrite al DS de los forms grandes es un bloque aparte.
 */

import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { confirmDestructive } from '../utils/confirm';
import { todayLocalISO } from '../utils/periods';
import { ordersRepo } from '../repos/orders';
import type { Order } from '../schemas/order';
import { ModalShell } from '../design';

type Props = {
  businessId: string;
  onSuccess: () => void;
  onClose: () => void;
  /** Si está presente, el form trabaja en modo edición (solo pedidos pending). */
  order?: Order;
  /** Prefill de fecha al crear desde un día puntual del calendario. */
  initialDeliveryDate?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function OrderForm({
  businessId, onSuccess, onClose, order, initialDeliveryDate,
}: Props) {
  const isEdit = !!order;

  const [clientName, setClientName]   = useState(order?.client_name ?? '');
  const [description, setDescription] = useState(order?.description ?? '');
  const [amount, setAmount]           = useState(
    order ? String(order.amount).replace('.', ',') : '',
  );
  const [deliveryDate, setDeliveryDate] = useState(
    order?.delivery_date ?? initialDeliveryDate ?? todayLocalISO(),
  );
  const [loading, setLoading]   = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError]       = useState('');

  const amountNumber = parseFloat(amount.replace(',', '.'));
  const canSubmit =
    clientName.trim().length > 0 &&
    description.trim().length > 0 &&
    !isNaN(amountNumber) && amountNumber > 0 &&
    DATE_RE.test(deliveryDate) &&
    !loading;

  // D-20.b — ¿cambios sin guardar? Backdrop/Esc piden confirmación; × directo.
  const initialAmountStr = order ? String(order.amount).replace('.', ',') : '';
  const initialDelivery = order?.delivery_date ?? initialDeliveryDate ?? todayLocalISO();
  const dirty = isEdit
    ? clientName !== (order?.client_name ?? '')
      || description !== (order?.description ?? '')
      || amount !== initialAmountStr
      || deliveryDate !== initialDelivery
    : clientName.trim() !== '' || description.trim() !== '' || amount.trim() !== '';

  const handleSave = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const result = isEdit && order
      ? await ordersRepo.update(order.id, businessId, {
          client_name: clientName.trim(),
          description: description.trim(),
          amount: amountNumber,
          delivery_date: deliveryDate,
        })
      : await ordersRepo.create({
          business_id: businessId,
          client_name: clientName.trim(),
          description: description.trim(),
          amount: amountNumber,
          delivery_date: deliveryDate,
        });

    setLoading(false);
    if (result.ok) onSuccess();
    else setError(result.message);
  };

  /** Cancelar pedido — destructivo (terminal), con confirmación cross-platform. */
  const handleCancelOrder = () => {
    if (!isEdit || !order) return;
    confirmDestructive({
      title: '¿Cancelar este pedido?',
      message: 'El pedido sale de tu agenda y no genera ninguna venta. Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setCanceling(true);
        setError('');
        const result = await ordersRepo.cancel(order.id, businessId);
        setCanceling(false);
        if (result.ok) onSuccess();
        else setError(result.message);
      },
    });
  };

  return (
    <ModalShell visible onClose={onClose} dirty={dirty}>
      <View style={styles.panel}>

        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          <Text style={styles.label}>¿Quién te lo encargó? *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Marta"
            placeholderTextColor="#4A4A6A"
            value={clientName}
            onChangeText={setClientName}
            maxLength={100}
            autoFocus={!isEdit}
          />

          <View style={styles.labelRow}>
            <Text style={styles.label}>¿Qué te encargó? *</Text>
            <Text style={styles.charCount}>{description.length}/120</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ej: 2 docenas de chipá"
            placeholderTextColor="#4A4A6A"
            value={description}
            onChangeText={setDescription}
            maxLength={120}
          />

          <Text style={styles.label}>Monto acordado *</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#4A4A6A"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>¿Para cuándo? *</Text>
          <TextInput
            style={styles.input}
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#4A4A6A"
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📅 El pedido aparece en tu calendario el día de entrega. La venta
              se registra recién cuando lo entregues — ahí te preguntamos si te pagaron.
            </Text>
          </View>

          {isEdit && (
            <TouchableOpacity
              style={[styles.cancelOrderBtn, canceling && { opacity: 0.5 }]}
              onPress={handleCancelOrder}
              disabled={canceling}
            >
              {canceling
                ? <ActivityIndicator color="#E74C3C" />
                : <Text style={styles.cancelOrderBtnText}>Cancelar pedido</Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>

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
              : <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Guardar pedido'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  // D-20.b — el overlay/backdrop ahora lo provee <ModalShell/> (#16).
  panel: {
    backgroundColor: '#12122A', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 18, paddingBottom: 0,
    maxHeight: '90%', borderTopWidth: 1, borderColor: '#1F8579',
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  panelTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 8 },
  closeText: { color: '#7F8C8D', fontSize: 20 },
  label: { color: '#A0A0B8', fontSize: 12, marginBottom: 6, marginTop: 12 },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  charCount: { color: '#4A4A6A', fontSize: 10, marginBottom: 6 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 12,
    borderWidth: 1, borderColor: '#1F8579', paddingHorizontal: 14,
  },
  currency: { color: '#1F8579', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
  amountInput: {
    flex: 1, color: '#FFFFFF', fontSize: 26,
    fontWeight: 'bold', paddingVertical: 10,
  },
  infoBox: {
    backgroundColor: '#0A1F1C', borderWidth: 1, borderColor: '#14443D',
    borderRadius: 10, padding: 12, marginTop: 14,
  },
  infoText: { color: '#5FBDB0', fontSize: 12, lineHeight: 17 },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  footer: {
    paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: '#1C1C30',
  },
  saveBtn: {
    backgroundColor: '#1F8579', paddingVertical: 13,
    borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E3B36', opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  cancelOrderBtn: {
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    marginTop: 14, marginBottom: 4,
    borderWidth: 1, borderColor: '#7A241C', backgroundColor: 'rgba(192,57,43,0.08)',
  },
  cancelOrderBtnText: { color: '#E74C3C', fontSize: 13, fontWeight: '600' },
});
