/**
 * transactionCategories.ts — catálogo de categorías y métodos de pago.
 *
 * F1-D: introducido para enriquecer la lista de movimientos. Antes los forms
 * guardaban strings libres ("Venta de producto") que aparecían como label
 * crudo. Ahora cada categoría tiene `value` (lo que se guarda en DB), `label`
 * (lo que se muestra), `icon` (emoji) y `tint` (color semántico del DS).
 *
 * Backwards compat: el campo `category` en `transactions` sigue siendo string
 * libre. `resolveCategory()` mapea tanto values nuevos como strings legacy a
 * la misma definición. No requiere migration de DB.
 *
 * Decisión: catálogo genérico (no por rubro). Cuando F1-C llegue (KPIs
 * industria estándar), podemos agregar `sectorRelevant?: SectorKey[]` a cada
 * categoría y filtrar en los forms.
 */

export type CategoryType = 'income' | 'expense';

/** Tinte semántico que se mapea a tokens del DS (color.success/warning/danger/info). */
export type CategoryTint = 'success' | 'warning' | 'danger' | 'info' | 'accent';

export type CategoryDef = {
  /** Lo que se guarda en `transactions.category`. Snake_case interno. */
  value: string;
  /** Lo que se muestra al usuario. Español rioplatense. */
  label: string;
  /** Emoji. Futuro: SVG icon. */
  icon: string;
  /** Tinte para fondo del ícono y para badges. */
  tint: CategoryTint;
  type: CategoryType;
};

/** Catálogo de categorías de INGRESO. */
export const INCOME_CATEGORIES: CategoryDef[] = [
  { value: 'service_main',  label: 'Servicio principal', icon: '✂️',  tint: 'success', type: 'income' },
  { value: 'service_extra', label: 'Servicio adicional', icon: '✨',  tint: 'success', type: 'income' },
  { value: 'product',       label: 'Venta de producto',  icon: '📦',  tint: 'success', type: 'income' },
  { value: 'advance',       label: 'Adelanto de cliente', icon: '💳', tint: 'info',    type: 'income' },
  { value: 'tip',           label: 'Propina',            icon: '🎁',  tint: 'success', type: 'income' },
  { value: 'other_income',  label: 'Otro ingreso',       icon: '↗️',  tint: 'success', type: 'income' },
];

/** Catálogo de categorías de COSTO. */
export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { value: 'supplies',      label: 'Insumos / Materia prima', icon: '🛒', tint: 'warning', type: 'expense' },
  { value: 'labor',         label: 'Mano de obra / Sueldos',  icon: '👥', tint: 'warning', type: 'expense' },
  { value: 'rent',          label: 'Alquiler',                icon: '🏠', tint: 'warning', type: 'expense' },
  { value: 'utilities',     label: 'Servicios (luz, gas, agua)', icon: '💡', tint: 'warning', type: 'expense' },
  { value: 'taxes',         label: 'Impuestos',               icon: '📋', tint: 'danger',  type: 'expense' },
  { value: 'transport',     label: 'Transporte',              icon: '🚚', tint: 'warning', type: 'expense' },
  { value: 'marketing',     label: 'Publicidad',              icon: '📢', tint: 'warning', type: 'expense' },
  { value: 'maintenance',   label: 'Mantenimiento',           icon: '🔧', tint: 'warning', type: 'expense' },
  { value: 'other_expense', label: 'Otro gasto',              icon: '↘️', tint: 'warning', type: 'expense' },
];

/**
 * Fallbacks para tipos extraordinarios. NO se ofrecen en los pickers; solo
 * aparecen en la lista cuando una transaction llega con type extraordinary.
 */
export const EXTRAORDINARY_CATEGORIES: CategoryDef[] = [
  { value: 'extra_income',  label: 'Ingreso extraordinario', icon: '🎁', tint: 'success', type: 'income' },
  { value: 'extra_expense', label: 'Gasto extraordinario',   icon: '⚠️', tint: 'danger',  type: 'expense' },
];

const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...EXTRAORDINARY_CATEGORIES,
];

/**
 * Mapa de strings legacy a values nuevos.
 *
 * Cubrimos lo que guardaba F0:
 *   - SaleForm: "Venta de producto", "Venta de servicio", "Adelanto de cliente", "Otro ingreso"
 *   - CostForm: "Insumos / Materia prima", "Mano de obra", "Alquiler", etc.
 *   - MovementForm: "Ingreso extraordinario", "Gasto extraordinario"
 *   - Algunos rastros más antiguos: "service", "product" (sin label fancy)
 */
const LEGACY_MAP: Record<string, string> = {
  // Income legacy
  'Venta de producto':    'product',
  'Venta de servicio':    'service_main',
  'Adelanto de cliente':  'advance',
  'Otro ingreso':         'other_income',
  'service':              'service_main',
  'product':              'product',

  // Expense legacy
  'Insumos / Materia prima': 'supplies',
  'Mano de obra':            'labor',
  'Alquiler':                'rent',
  'Servicios públicos':      'utilities',
  'Impuestos':               'taxes',
  'Transporte':              'transport',
  'Otro costo':              'other_expense',

  // Extraordinary legacy
  'Ingreso extraordinario':  'extra_income',
  'Gasto extraordinario':    'extra_expense',
};

/**
 * Devuelve la definición de categoría para un raw string (nuevo o legacy).
 * `null` si no hay match.
 */
export function resolveCategory(raw: string | null | undefined): CategoryDef | null {
  if (!raw) return null;
  // Match directo (valor nuevo)
  const direct = ALL_CATEGORIES.find(c => c.value === raw);
  if (direct) return direct;
  // Match vía legacy
  const legacyValue = LEGACY_MAP[raw];
  if (legacyValue) {
    return ALL_CATEGORIES.find(c => c.value === legacyValue) ?? null;
  }
  return null;
}

/** Devuelve las categorías ofrecibles en un form de income o expense. */
export function getCategoriesForType(type: CategoryType): CategoryDef[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

// ────────────────────────────────────────────────────────────────────
// MÉTODOS DE PAGO — catálogo paralelo
// ────────────────────────────────────────────────────────────────────

export type PaymentMethodDef = {
  value: string;
  label: string;
  icon: string;
  /** Texto cortito para el chip en la lista ("Efectivo" → "Efec."). */
  short: string;
};

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { value: 'cash',     label: 'Efectivo',         icon: '💵', short: 'Efectivo'   },
  { value: 'transfer', label: 'Transferencia',    icon: '🔵', short: 'Transf.'    },
  { value: 'credit',   label: 'Tarjeta',          icon: '💳', short: 'Tarjeta'    },
  { value: 'digital',  label: 'Billetera digital', icon: '📱', short: 'Digital'   },
  { value: 'pending',  label: 'Pendiente',        icon: '⏳', short: 'Pendiente'  },
];

/** Helper: encuentra la definición de un payment method por value (raw del DB). */
export function resolvePaymentMethod(
  raw: string | null | undefined,
): PaymentMethodDef | null {
  if (!raw) return null;
  return PAYMENT_METHODS.find(m => m.value === raw) ?? null;
}
