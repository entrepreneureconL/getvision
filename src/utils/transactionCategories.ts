import type { PaymentMethod } from '../schemas/transaction';
import type { AccountKind } from '../schemas/account';
import type { CategoryOverride } from '../schemas/categoryOverride';

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
  // F1-O Etapa 2: la RPC deliver_order guarda category='pedido' al convertir
  // un pedido en venta — esta default hace que el desglose por etiqueta lo
  // muestre como concepto propio (sin migration — ADR #15, string libre).
  { value: 'pedido',        label: 'Pedido entregado',   icon: '🧺',  tint: 'success', type: 'income' },
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

/**
 * F1-J — Subtipos de "Movement" (aportes/retiros del dueño + transferencias
 * entre cuentas propias). Antes el MovementForm guardaba todo como categoría
 * libre "Ingreso extraordinario" / "Gasto extraordinario" — los subtipos
 * permiten distinguir en reportes y excluirlos correctamente del cómputo de
 * ganancia operativa (los aportes no son ingreso real; las transferencias no
 * son ni ingreso ni gasto, solo mueven plata).
 *
 * Convención:
 *   - owner_in/out → afecta el patrimonio (no entra al resultado del mes).
 *     Fila única con to_account_id (aporte) o from_account_id (retiro).
 *   - transfer    → mueve plata entre cuentas propias (cero efecto en P&L).
 *     Una sola fila con from_account_id + to_account_id seteados en simultáneo.
 *     `accountsRepo.getBalances` resta del from y suma al to, conservando la
 *     identidad contable. Atómico, sin riesgo de dejar mitades sueltas.
 *
 * MovementForm (F1-J.5c) usa estos values directamente como tabs.
 */
export const MOVEMENT_CATEGORIES: CategoryDef[] = [
  { value: 'owner_in',  label: 'Aporte del dueño',        icon: '➕', tint: 'success', type: 'income' },
  { value: 'owner_out', label: 'Retiro del dueño',        icon: '➖', tint: 'danger',  type: 'expense' },
  { value: 'transfer', label: 'Transferencia entre cuentas', icon: '🔁', tint: 'info',  type: 'income' },
];

const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...EXTRAORDINARY_CATEGORIES,
  ...MOVEMENT_CATEGORIES,
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
 * F1-L: helper interno para convertir un CategoryOverride en CategoryDef.
 * Los enums (tint/type) son estructuralmente iguales — solo cambio de label.
 */
function overrideToDef(o: CategoryOverride): CategoryDef {
  return {
    value: o.value,
    label: o.label,
    icon: o.icon,
    tint: o.tint as CategoryTint,
    type: o.type as CategoryType,
  };
}

/**
 * Devuelve la definición de categoría para un raw string (nuevo o legacy).
 * `null` si no hay match.
 *
 * F1-L: ahora acepta overrides per business. Prioridad:
 *   1. Override custom activo (is_archived=false) con value matchea.
 *   2. Default exacto en ALL_CATEGORIES.
 *   3. Match vía LEGACY_MAP a un default.
 */
export function resolveCategory(
  raw: string | null | undefined,
  overrides: CategoryOverride[] = [],
): CategoryDef | null {
  if (!raw) return null;

  // F1-L: prioridad a customs (incluso archivados — para preservar el label
  // histórico en transactions guardadas con una custom que luego se archivó).
  // El archive solo afecta al picker (getCategoriesForType), no al display.
  const override = overrides.find(o => o.value === raw);
  if (override) return overrideToDef(override);

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

/**
 * Devuelve las categorías ofrecibles en un form de income o expense.
 *
 * F1-L: compone (a) defaults menos los archivados + (b) customs no-archivados.
 *
 * Si no se pasan overrides, devuelve solo defaults (backwards-compat con todo
 * el código que llamaba sin segundo argumento).
 */
export function getCategoriesForType(
  type: CategoryType,
  overrides: CategoryOverride[] = [],
): CategoryDef[] {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Defaults archivados por este business (override is_archived=true que matchea).
  const archivedValues = new Set(
    overrides
      .filter(o => o.is_archived && o.type === type)
      .map(o => o.value),
  );

  // Customs nuevos (value libre, NO matchea un default, is_archived=false).
  const defaultValues = new Set(defaults.map(d => d.value));
  const customs: CategoryDef[] = overrides
    .filter(o => !o.is_archived && o.type === type && !defaultValues.has(o.value))
    .map(overrideToDef);

  return [
    ...defaults.filter(d => !archivedValues.has(d.value)),
    ...customs,
  ];
}

// ────────────────────────────────────────────────────────────────────
// MÉTODOS DE PAGO — catálogo paralelo
// ────────────────────────────────────────────────────────────────────

export type PaymentMethodDef = {
  /** Coincide con PaymentMethodEnum del schema → tipado estricto. */
  value: PaymentMethod;
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

/**
 * F1-K.1 (ADR #22): derivar `payment_method` desde el kind de la cuenta
 * seleccionada. Reemplaza el picker manual de "Forma de cobro/pago" que era
 * redundante con el selector de cuenta.
 *
 *   cash    → cash
 *   mp      → digital
 *   wallet  → digital
 *   bank    → transfer  (default; en F2 se reintroduce sub-selector aquí si
 *                        hace falta distinguir transferencia vs tarjeta para
 *                        reconciliación bancaria)
 *   other   → cash      (fallback conservador)
 *
 * Si en el futuro hay accounts customs con kind='other', el derived 'cash'
 * es solo un valor por defecto — el usuario puede igual editar la transaction
 * y cambiar el método manualmente desde el editor (cuando F2 lo introduzca).
 */
export function paymentMethodFromAccountKind(kind: AccountKind): PaymentMethod {
  switch (kind) {
    case 'cash':   return 'cash';
    case 'mp':     return 'digital';
    case 'wallet': return 'digital';
    case 'bank':   return 'transfer';
    case 'other':  return 'cash';
  }
}

// ────────────────────────────────────────────────────────────────────
// SUGERENCIAS POR RUBRO — F1-L.5
// ────────────────────────────────────────────────────────────────────

/**
 * Definición de una sugerencia. Mismo shape que CategoryDef salvo que no es
 * obligatorio que el usuario la cree — son chips tap-to-create en el modal
 * AddCategoryModal y en el editor de Settings.
 *
 * El `value` debe ser snake_case (mismo patrón que defaults) — al crearse
 * como override, ese value se guarda en `category_overrides.value` y en
 * `transactions.category`. Si ya existe una sugerencia con ese value como
 * default (mismo slug), `getSuggestedCategoriesForRubro` la filtra para
 * no duplicar.
 *
 * Filosofía:
 *   - 4 rubros pivote en esta primera vuelta (los más comunes en F0/F1
 *     según uso real esperado): Gastronomía, Belleza y Estética,
 *     Alimentos y Bebidas (kioscos/almacenes), Asesoramiento Profesional.
 *   - 4-8 sugerencias por (rubro, type). Más chips abruman el picker.
 *   - Habla el vocabulario del usuario tradicional (ADR §12.3 "Tradicional
 *     establecido"). NO genéricas — para genéricas ya están los defaults.
 *   - Iterar con feedback beta. El mapa es 100% editable sin migration.
 */
export type SuggestedCategoryDef = {
  value: string;
  label: string;
  icon: string;
  tint: CategoryTint;
  type: CategoryType;
};

/**
 * Mapa rubro → sugerencias. La key debe coincidir EXACTAMENTE con el `rubro`
 * guardado en `businesses.rubro` (case-sensitive). Ver `businessProfile.ts`
 * para la lista canónica.
 */
export const SUGGESTED_CATEGORIES_BY_RUBRO: Record<string, SuggestedCategoryDef[]> = {
  // ───── Gastronomía (commerce) ─────
  'Gastronomía': [
    // Income
    { value: 'menu_principal', label: 'Menú principal',     icon: '🍽️', tint: 'success', type: 'income' },
    { value: 'delivery_venta', label: 'Delivery',            icon: '🛵', tint: 'success', type: 'income' },
    { value: 'take_away',      label: 'Para llevar',         icon: '📦', tint: 'success', type: 'income' },
    { value: 'bebidas_venta',  label: 'Bebidas y vinos',     icon: '🥂', tint: 'success', type: 'income' },
    { value: 'evento_catering', label: 'Evento / Catering',  icon: '🎉', tint: 'info',    type: 'income' },
    // Expense
    { value: 'mercaderia_perecedera', label: 'Mercadería fresca', icon: '🥬', tint: 'warning', type: 'expense' },
    { value: 'bebidas_compra',        label: 'Compra de bebidas', icon: '🍷', tint: 'warning', type: 'expense' },
    { value: 'gas_cocina',            label: 'Gas / Cocina',       icon: '🔥', tint: 'warning', type: 'expense' },
    { value: 'comision_delivery',     label: 'Comisión apps delivery', icon: '🛵', tint: 'warning', type: 'expense' },
    { value: 'descartables',          label: 'Descartables / Packaging', icon: '🥡', tint: 'warning', type: 'expense' },
  ],

  // ───── Belleza y Estética (commerce) ─────
  'Belleza y Estética': [
    // Income
    { value: 'corte',             label: 'Corte de pelo',           icon: '💇', tint: 'success', type: 'income' },
    { value: 'color_tintura',     label: 'Color / Tintura',         icon: '🎨', tint: 'success', type: 'income' },
    { value: 'tratamiento',       label: 'Tratamiento capilar',     icon: '💆', tint: 'success', type: 'income' },
    { value: 'manicura_pedicura', label: 'Manicura / Pedicura',     icon: '💅', tint: 'success', type: 'income' },
    { value: 'venta_productos',   label: 'Venta de productos',      icon: '🧴', tint: 'success', type: 'income' },
    // Expense
    { value: 'productos_quimicos', label: 'Productos / Tinturas',   icon: '🧪', tint: 'warning', type: 'expense' },
    { value: 'herramientas_corte', label: 'Herramientas / Tijeras', icon: '✂️', tint: 'warning', type: 'expense' },
    { value: 'alquiler_sillon',    label: 'Alquiler de sillón',     icon: '💺', tint: 'warning', type: 'expense' },
    { value: 'lavanderia',         label: 'Lavandería / Toallas',   icon: '🧺', tint: 'warning', type: 'expense' },
  ],

  // ───── Alimentos y Bebidas (kioscos, almacenes) ─────
  'Alimentos y Bebidas': [
    // Income
    { value: 'cigarrillos',  label: 'Cigarrillos',          icon: '🚬', tint: 'success', type: 'income' },
    { value: 'bebidas_venta', label: 'Bebidas',             icon: '🥤', tint: 'success', type: 'income' },
    { value: 'golosinas',    label: 'Golosinas y snacks',    icon: '🍬', tint: 'success', type: 'income' },
    { value: 'panificados',  label: 'Pan / Facturas',        icon: '🥖', tint: 'success', type: 'income' },
    { value: 'almacen_gral', label: 'Almacén general',       icon: '🛒', tint: 'success', type: 'income' },
    // Expense
    { value: 'mercaderia_seca',    label: 'Mercadería seca',         icon: '📦', tint: 'warning', type: 'expense' },
    { value: 'bebidas_compra',     label: 'Compra de bebidas',       icon: '🥤', tint: 'warning', type: 'expense' },
    { value: 'cigarrillos_compra', label: 'Compra de cigarrillos',   icon: '🚬', tint: 'warning', type: 'expense' },
    { value: 'flete_proveedor',    label: 'Flete de proveedor',      icon: '🚛', tint: 'warning', type: 'expense' },
    { value: 'rotura_vencido',     label: 'Rotura / Vencidos',       icon: '❌', tint: 'danger',  type: 'expense' },
  ],

  // ───── Asesoramiento Profesional (services) ─────
  'Asesoramiento Profesional': [
    // Income
    { value: 'hora_consulta',  label: 'Hora de consulta',     icon: '🕐', tint: 'success', type: 'income' },
    { value: 'retainer',       label: 'Retainer mensual',     icon: '📅', tint: 'info',    type: 'income' },
    { value: 'proyecto',       label: 'Proyecto cerrado',     icon: '📑', tint: 'success', type: 'income' },
    { value: 'dictamen',       label: 'Dictamen / Informe',   icon: '📋', tint: 'success', type: 'income' },
    // Expense
    { value: 'colegio_profesional', label: 'Cuota colegio profesional', icon: '🎓', tint: 'warning', type: 'expense' },
    { value: 'software_pro',        label: 'Software profesional',      icon: '💻', tint: 'warning', type: 'expense' },
    { value: 'capacitacion',        label: 'Capacitación / Cursos',     icon: '📚', tint: 'warning', type: 'expense' },
    { value: 'oficina_coworking',   label: 'Oficina / Coworking',       icon: '🏢', tint: 'warning', type: 'expense' },
  ],
};

/**
 * Devuelve las sugerencias relevantes para (rubro, type), filtrando:
 *   1. Las que ya son default activo en el catálogo (no duplicar el picker).
 *   2. Las que ya fueron creadas por este business (override custom).
 *   3. Las que ya fueron archivadas explícitamente (respeta la decisión).
 *
 * Si el rubro no está mapeado o es `null`, devuelve [] (graceful degradation).
 * La UI debe esconder la sección "Sugerencias para tu rubro" cuando este
 * helper devuelve vacío.
 */
export function getSuggestedCategoriesForRubro(
  rubro: string | null | undefined,
  type: CategoryType,
  overrides: CategoryOverride[] = [],
): SuggestedCategoryDef[] {
  if (!rubro) return [];
  const suggestions = SUGGESTED_CATEGORIES_BY_RUBRO[rubro];
  if (!suggestions) return [];

  const defaultValues = new Set(
    (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => c.value),
  );
  const overrideValues = new Set(overrides.map(o => o.value));

  return suggestions.filter(s =>
    s.type === type &&
    !defaultValues.has(s.value) &&
    !overrideValues.has(s.value),
  );
}
