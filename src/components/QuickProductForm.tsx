/**
 * <QuickProductForm /> — modal rápido para agregar un producto al catálogo.
 *
 * Diseño deliberadamente mínimo:
 *   - 4 campos: nombre, stock inicial, costo unitario (opcional), precio venta (opcional).
 *   - No edita productos existentes (eso en Fase 1).
 *   - No maneja SKU, categorías, ni umbral de stock bajo (defaults sirven).
 *
 * Es la entrada rápida que necesita un kiosco para registrar "Coca 500ml × 20".
 * Para alguien con 200 SKUs el flujo correcto es la import CSV de Fase 1.
 */

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { productsRepo } from '../repos/products';

type Props = {
  businessId: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;   // dispara recarga del dashboard
};

export default function QuickProductForm({ businessId, visible, onClose, onSuccess }: Props) {
  const [name, setName]         = useState('');
  const [stock, setStock]       = useState('');
  const [cost, setCost]         = useState('');
  const [price, setPrice]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const reset = () => {
    setName(''); setStock(''); setCost(''); setPrice(''); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    setError('');
    if (name.trim().length < 1) {
      setError('Ponele un nombre al producto.');
      return;
    }
    const stockNum = parseFloat(stock.replace(',', '.'));
    if (isNaN(stockNum) || stockNum < 0) {
      setError('Stock inválido. Usá un número (puede ser 0).');
      return;
    }
    const costNum  = cost  ? parseFloat(cost.replace(',', '.'))  : undefined;
    const priceNum = price ? parseFloat(price.replace(',', '.')) : undefined;

    setSaving(true);
    const created = await productsRepo.create({
      business_id: businessId,
      name: name.trim(),
      stock_actual: stockNum,
      unit_cost: costNum,
      unit_price: priceNum,
    });
    setSaving(false);

    if (!created) {
      setError('No se pudo guardar. Probá de nuevo.');
      return;
    }
    reset();
    onSuccess();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>📦 Nuevo producto</Text>
          <Text style={styles.subtitle}>Carga rápida — los detalles los editás después.</Text>

          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Coca 500ml"
            placeholderTextColor="#4A4A6A"
            maxLength={120}
            autoFocus
          />

          <Text style={styles.label}>Stock inicial *</Text>
          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            placeholder="Ej: 20"
            placeholderTextColor="#4A4A6A"
            keyboardType="decimal-pad"
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Costo unit.</Text>
              <TextInput
                style={styles.input}
                value={cost}
                onChangeText={setCost}
                placeholder="$"
                placeholderTextColor="#4A4A6A"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Precio venta</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="$"
                placeholderTextColor="#4A4A6A"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {error.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#0F0F1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2A2A4A', alignSelf: 'center', marginBottom: 16 },
  title:    { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#7F8C8D', fontSize: 12, marginBottom: 18 },
  label:    { color: '#A0A0B8', fontSize: 12, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#2A2A4A',
  },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  errorBox: {
    backgroundColor: '#2A0A0A', borderWidth: 1, borderColor: '#E74C3C',
    borderRadius: 8, padding: 10, marginTop: 14,
  },
  errorText: { color: '#E74C3C', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#2A2A4A', alignItems: 'center',
  },
  cancelText: { color: '#7F8C8D', fontSize: 14 },
  saveBtn: {
    flex: 2, backgroundColor: '#27AE60', paddingVertical: 14,
    borderRadius: 10, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});
