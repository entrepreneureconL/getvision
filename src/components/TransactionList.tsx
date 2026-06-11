/**
 * <TransactionList /> — lista de movimientos recientes.
 *
 * F1-D rediseño + enriquecimiento de datos (Task #10):
 *   - Card única envolvente, dividers subtle entre items.
 *   - Ícono cuadrado redondeado con bg tintado del color de la **categoría**
 *     (antes era por type genérico).
 *   - Texto: descripción primary + (categoría · fecha · método de pago) tertiary.
 *   - Monto a la derecha con color semántico.
 *
 * Si la transaction tiene `description`, esa va primero. Si no, el label de
 * la categoría (resuelta vía catálogo) actúa de fallback.
 *
 * El método de pago aparece como sub-info textual ("Hoy · Efectivo") cuando
 * está presente, no como chip — para no inflar visualmente cada ítem.
 */

import { View, Text as RNText, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isPending as txIsPending, type Transaction } from '../schemas/transaction';
import type { CategoryOverride } from '../schemas/categoryOverride';
import { formatMoney } from './Money';
import { Text, Stack, Card, Divider, color, radius, space } from '../design';
import {
  resolveCategory,
  resolvePaymentMethod,
  type CategoryDef,
} from '../utils/transactionCategories';

type Props = {
  transactions: Transaction[];
  /** Cantidad máxima a mostrar. Sin límite si no se pasa. */
  limit?: number;
  /** Mensaje del empty state. */
  emptyMessage?: string;
  /** Si false, retorna null cuando no hay items (útil si querés controlar el empty afuera). */
  showEmptyState?: boolean;
  /** Si se pasa, tap en cada item dispara este callback (F1-D Task #11 — editar). */
  onItemPress?: (t: Transaction) => void;
  /** F1-L: overrides del business para que resolveCategory matchee customs y archive. */
  categoryOverrides?: CategoryOverride[];
};

/**
 * Mapea el `tint` de una CategoryDef al hex de fondo (subtle del DS).
 * Centralizado acá para no esparcir literales por la lista.
 */
function tintToBg(tint: CategoryDef['tint']): string {
  switch (tint) {
    case 'success': return color.success.subtle;
    case 'warning': return color.warning.subtle;
    case 'danger':  return color.danger.subtle;
    case 'info':    return color.info.subtle;
    case 'accent':  return color.accent.subtle;
  }
}

/**
 * Mapea el `tint` al color semántico de texto para el monto.
 * Income → success. Expense → danger (warning quedó muy parecido a danger en
 * texto chico — mejor un único rojo para gastos en la columna del monto).
 */
function tintToAmountColor(tint: CategoryDef['tint']): 'success' | 'danger' | 'accent' {
  if (tint === 'success') return 'success';
  if (tint === 'accent') return 'accent';
  return 'danger';
}

/** Fallback cuando no hay match en el catálogo (cat raw desconocida). */
function fallbackForType(type: Transaction['type']): {
  icon: string;
  tint: CategoryDef['tint'];
  label: string;
} {
  if (type === 'income' || type === 'income_extraordinary') {
    return { icon: '💵', tint: 'success', label: 'Ingreso' };
  }
  return { icon: '🛒', tint: 'warning', label: 'Egreso' };
}

/**
 * Formato de fecha relativo a hoy.
 *   Hoy → "Hoy"
 *   Ayer → "Ayer"
 *   2-6 días → "Hace N días"
 *   Mañana → "Mañana"
 *   +2 a +6 días → "En N días"
 *   ≥7 días en cualquier dirección → "DD MMM"
 *
 * dateStr llega como 'YYYY-MM-DD'.
 */
function relativeDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays === -1) return 'Mañana';
  if (diffDays < -1 && diffDays > -7) return `En ${-diffDays} días`;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function TransactionList({
  transactions,
  limit,
  emptyMessage = 'Sin movimientos por ahora.',
  showEmptyState = true,
  onItemPress,
  categoryOverrides,
}: Props) {
  const items = limit != null ? transactions.slice(0, limit) : transactions;

  if (items.length === 0) {
    if (!showEmptyState) return null;
    return (
      <Card variant="surface" padding="lg">
        <Stack gap="2" align="center">
          <Ionicons name="file-tray-outline" size={28} color={color.text.tertiary} />
          <Text variant="caption" color="tertiary" align="center">
            {emptyMessage}
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card variant="surface" padding="none">
      {items.map((t, i) => (
        <View key={t.id}>
          <Item
            transaction={t}
            onPress={onItemPress}
            categoryOverrides={categoryOverrides}
          />
          {i < items.length - 1 ? <Divider variant="subtle" /> : null}
        </View>
      ))}
    </Card>
  );
}

/** Un ítem individual de la lista. Extraído para legibilidad. */
function Item({
  transaction,
  onPress,
  categoryOverrides,
}: {
  transaction: Transaction;
  onPress?: (t: Transaction) => void;
  categoryOverrides?: CategoryOverride[];
}) {
  // F1-L: pasamos overrides para que customs muestren su label/icon real.
  const cat = resolveCategory(transaction.category, categoryOverrides ?? []);
  const pm = resolvePaymentMethod(transaction.payment_method);
  const fallback = fallbackForType(transaction.type);

  const icon = cat?.icon ?? fallback.icon;
  const tint = cat?.tint ?? fallback.tint;
  const catLabel = cat?.label ?? fallback.label;

  // Si hay descripción, va como label primario y la categoría aparece debajo.
  // Si no, la categoría es el label primario y la sub-info es solo fecha+pago.
  const hasDescription = !!transaction.description;
  const primaryLabel = hasDescription ? transaction.description! : catLabel;

  const subParts: string[] = [];
  if (hasDescription) subParts.push(catLabel);
  subParts.push(relativeDate(transaction.date));
  if (pm) subParts.push(pm.short);

  const isIncome =
    transaction.type === 'income' || transaction.type === 'income_extraordinary';
  const sign = isIncome ? '+' : '−';
  const amountColor = tintToAmountColor(tint);

  // F1-J: estado pendiente desde settled_at (source of truth). El status legacy
  // queda como fallback por si la fila no tiene settled_at por algún motivo.
  const pending = txIsPending(transaction) || transaction.status === 'pending';

  /** El ítem se vuelve tappable solo si el caller pasó onPress.
   *  Para extraordinarios (no editables hoy) seguimos pasando el callback
   *  pero el DashboardScreen los ignora — separación de responsabilidades. */
  const handlePress = onPress ? () => onPress(transaction) : undefined;

  const content = (
    <Stack
      direction="row"
      align="center"
      justify="space-between"
      gap="3"
      style={{ paddingVertical: space['3'], paddingHorizontal: space['4'] }}
    >
      <Stack direction="row" align="center" gap="3" style={{ flex: 1 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: tintToBg(tint),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RNText style={{ fontSize: 18 }}>{icon}</RNText>
        </View>

        <Stack gap="0" style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {primaryLabel}
            {pending ? '  ·  pendiente' : ''}
          </Text>
          <Text variant="caption" color="tertiary" numberOfLines={1}>
            {subParts.join('  ·  ')}
          </Text>
        </Stack>
      </Stack>

      <Text variant="bodyStrong" color={amountColor}>
        {sign} $ {formatMoney(transaction.amount)}
      </Text>
    </Stack>
  );

  if (handlePress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}
