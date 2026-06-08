/**
 * <QuickHoursForm /> — modal rápido para registrar horas trabajadas.
 *
 * Campos mínimos: fecha (default hoy), horas, descripción, rate $, billable.
 * client_name lo dejamos para Fase 1 cuando exista tabla clients.
 */

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { hoursLogRepo } from '../repos/hoursLog';

type Props = {
  businessId: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function QuickHoursForm({ businessId, visible, onClose, onSuccess }: Props) {
  const [date, setDate]         = useState(todayISO());
  const [hours, setHours]       = useState('');
  const [rate, setRate]         = useState('');
  const [desc, setDesc]         = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const reset = () => {
    setDate(todayISO()); setHours(''); setRate(''); setDesc('');
    setBillable(true); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    setError('');
    const hoursNum = parseFloat(hours.replace(',', '.'));
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setError('Horas inválidas. Tiene que ser mayor a 0.');
      return;
    }
    if (hoursNum > 24) {
      setError('¿Más de 24 horas en un día? Revisalo.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Fecha inválida. Formato: AAAA-MM-DD.');
      return;
    }
    const rateNum = rate ? parseFloat(rate.replace(',', '.')) : undefined;

    setSaving(true);
    const created = await hoursLogRepo.create({
      business_id: businessId,
      date,
      hours: hoursNum,
      hourly_rate: rateNum,
      description: desc.trim() || undefined,
      billable,
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

          <Text style={styles.title}>⏱ Registrar horas</Text>
          <Text style={styles.subtitle}>Cuánto trabajaste hoy (o el día que indiques).</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Fecha *</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#4A4A6A"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Horas *</Text>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                placeholder="2,5"
                placeholderTextColor="#4A4A6A"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>

          <Text style={styles.label}>Tarifa $/hora</Text>
          <TextInput
            style={styles.input}
            value={rate}
            onChangeText={setRate}
            placeholder="Ej: 5000"
            placeholderTextColor="#4A4A6A"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>¿Qué hiciste?</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Ej: Plomería casa familia Gómez"
            placeholderTextColor="#4A4A6A"
            maxLength={160}
            multiline
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>¿Es facturable?</Text>
              <Text style={styles.switchHint}>
                Apagalo si es capacitación, admin o no cobrás por estas horas.
              </Text>
            </View>
            <Switch
              value={billable}
              onValueChange={setBillable}
              trackColor={{ false: '#2A2A4A', true: '#1A6B3A' }}
              thumbColor={billable ? '#27AE60' : '#7F8C8D'}
            />
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
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#141422', borderRadius: 10, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: '#1C1C30',
  },
  switchLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  switchHint:  { color: '#7F8C8D', fontSize: 11, marginTop: 2 },
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
    flex: 2, backgroundColor: '#2E86C1', paddingVertical: 14,
    borderRadius: 10, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});
