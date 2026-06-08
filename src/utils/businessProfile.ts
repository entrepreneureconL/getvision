/**
 * businessProfile.ts — catálogo de sectores → rubros → subrubros + configuración del dashboard.
 *
 * F0-2.5: estructura nueva con 3 niveles. Cambios significativos:
 *   - "Logística y Transporte" se separa en "Transporte Pesado y Fletes" + "Transporte de Personas"
 *   - "Automotriz" se separa en "Taller Mecánico" (services) + "Repuestos y Accesorios Automotrices" (commerce)
 *   - Nuevo rubro: "Gimnasio y Wellness"
 *   - Cada rubro relevante tiene un array de SUBRUBROS para drill-down en onboarding
 *   - getDashboardConfig: ya NO oculta KPIs. Sólo decide énfasis y copy.
 *
 * Los tipos Business / IncomeModel / Sector / DetailLevel / OperatorRole vienen del schema zod.
 */

import type { Business, IncomeModel, Sector, DetailLevel, OperatorRole } from '../schemas/business';
export type { Business, IncomeModel, Sector, DetailLevel, OperatorRole };

// ────────────────────────────────────────────────────────────────────
// SECTORS — primer nivel
// ────────────────────────────────────────────────────────────────────

export const SECTORS = [
  {
    key: 'services',
    label: 'Servicios',
    icon: '🔧',
    description: 'Ofrecés tu tiempo, trabajo o conocimiento',
  },
  {
    key: 'commerce',
    label: 'Comercio',
    icon: '🛍️',
    description: 'Vendés productos a clientes directos',
  },
  {
    key: 'industry',
    label: 'Industria',
    icon: '🏭',
    description: 'Fabricás o transformás productos',
  },
  {
    key: 'agro',
    label: 'Agro',
    icon: '🌾',
    description: 'Producción agropecuaria',
  },
];

// ────────────────────────────────────────────────────────────────────
// RUBROS — segundo nivel, por sector
// ────────────────────────────────────────────────────────────────────

export const RUBROS: Record<string, string[]> = {
  services: [
    // F0-9: Belleza y Estética + Gastronomía movidos a Comercio
    // (la mayoría del usuario los percibe como locales, no servicios).
    'Salud',
    'Gimnasio y Wellness',
    'Educación y Formación',
    'Tecnología y Sistemas',
    'Asesoramiento Profesional',
    'Transporte Pesado y Fletes',
    'Transporte de Personas',
    'Arte y Diseño',
    'Construcción y Reformas',
    'Taller Mecánico',
    'Otro servicio',
  ],
  commerce: [
    'Alimentos y Bebidas',
    'Gastronomía',                          // F0-9: movido desde services
    'Belleza y Estética',                   // F0-9: movido desde services
    'Indumentaria y Calzado',
    'Electrónica y Tecnología',
    'Hogar y Decoración',
    'Ferretería y Materiales',
    'Farmacia y Salud',
    'Librería y Papelería',
    'Repuestos y Accesorios Automotrices',
    'Remisería y Agencia de Transporte',    // F0-9: nuevo (empresa con flota)
    'Otro comercio',
  ],
  industry: [
    'Alimentos Elaborados',
    'Textil y Confección',
    'Metalurgia',
    'Química y Plásticos',
    'Madera y Muebles',
    'Construcción',
    'Otra industria',
  ],
  agro: [
    'Agricultura',
    'Ganadería',
    'Avicultura',
    'Fruticultura',
    'Apicultura',
    'Otro agro',
  ],
};

// ────────────────────────────────────────────────────────────────────
// SUBRUBROS — tercer nivel, por rubro
// Sólo se definen para rubros donde aporta precisión. Otros usan rubro como
// "subrubro implícito". En onboarding, si SUBRUBROS[rubro] es undefined, se
// saltea el paso de subrubro.
// ────────────────────────────────────────────────────────────────────

export const SUBRUBROS: Record<string, string[]> = {
  // ───── SERVICES ─────
  'Belleza y Estética': [
    'Peluquería',
    'Barbería',
    'Manicura y Pedicura',
    'Spa y Masajes',
    'Estética facial y corporal',
    'Tatuajes y Piercings',
    'Otra belleza',
  ],
  'Gastronomía': [
    'Restaurant',
    'Bar y Cafetería',
    'Comida para llevar / Delivery',
    'Catering para eventos',
    'Otra gastronomía',
  ],
  'Salud': [
    'Consultorio médico',
    'Odontología',
    'Kinesiología y Fisioterapia',
    'Psicología y Terapias',
    'Otra salud',
  ],
  'Gimnasio y Wellness': [
    'Gimnasio',
    'Pilates / Yoga',
    'Crossfit / Funcional',
    'Otros wellness',
  ],
  'Educación y Formación': [
    'Clases particulares',
    'Academia / Cursos',
    'Coaching profesional',
    'Otra educación',
  ],
  'Tecnología y Sistemas': [
    'Desarrollo de software',
    'Soporte técnico',
    'Diseño UX/UI',
    'Otra tecnología',
  ],
  'Asesoramiento Profesional': [
    'Contador / Impuestos',
    'Abogado',
    'Consultor de negocios',
    'Otros profesionales',
  ],
  'Transporte Pesado y Fletes': [
    'Mudanzas',
    'Fletes y cargas',
    'Distribución',
    'Otro transporte pesado',
  ],
  'Transporte de Personas': [
    'Apps de movilidad',
    'Remis / Taxi',
    'Transfer / Turismo',
    'Otro transporte personas',
  ],
  'Arte y Diseño': [
    'Diseño gráfico / Ilustración',
    'Fotografía / Audiovisual',
    'Música / Producción',
    'Otro arte',
  ],
  'Construcción y Reformas': [
    'Albañilería',
    'Plomería',
    'Electricidad',
    'Pintura',
    'Reformas integrales',
    'Otro construcción',
  ],
  'Taller Mecánico': [
    'Mecánica general',
    'Chapa y pintura',
    'Electricidad automotriz',
    'Otro taller',
  ],

  // ───── COMMERCE ─────
  'Alimentos y Bebidas': [
    'Kiosco',
    'Almacén / Despensa',
    'Panadería',
    'Carnicería / Verdulería',
    'Vinería / Distribuidora',
    'Otro alimentos',
  ],
  'Indumentaria y Calzado': [
    'Ropa adulto',
    'Ropa infantil',
    'Calzado',
    'Indumentaria deportiva',
    'Otro indumentaria',
  ],
  'Electrónica y Tecnología': [
    'Electrónica de consumo',
    'Insumos informáticos',
    'Telefonía y accesorios',
    'Otro electrónica',
  ],
  'Hogar y Decoración': [
    'Mueblería',
    'Bazar / Decoración',
    'Textil hogar',
    'Otro hogar',
  ],
  'Farmacia y Salud': [
    'Farmacia',
    'Ortopedia',
    'Productos naturistas',
    'Otro farmacia',
  ],
  'Repuestos y Accesorios Automotrices': [
    'Repuestos generales',
    'Lubricentros',
    'Accesorios y tuning',
    'Otro repuestos',
  ],

  // F0-9: nuevo rubro Comercio — empresa con flota (vs Transporte de Personas
  // en Servicios que es individuo con su vehículo).
  'Remisería y Agencia de Transporte': [
    'Remisería con flota',
    'Agencia de transporte',
    'Servicio de transfer corporativo',
    'Otro flota',
  ],

  // Rubros sin subrubros: 'Ferretería y Materiales', 'Librería y Papelería',
  // 'Otro servicio', 'Otro comercio', y todos los de industry/agro.
};

// ────────────────────────────────────────────────────────────────────
// Configuración del dashboard derivada del business
// ────────────────────────────────────────────────────────────────────

/**
 * F0-2.5: getDashboardConfig YA NO oculta KPIs.
 *
 * Antes: showStockKPI / showHoursKPI eran toggles binarios.
 * Ahora: ambos siempre se muestran. El income_model decide ORDEN y ÉNFASIS,
 *        no visibility. El detail_level (a otro nivel) decide densidad.
 *
 * Los campos showStockKPI/showHoursKPI se mantienen por compatibilidad pero
 * siempre devuelven true. Lo que cambia es emphasizeStock/emphasizeHours
 * (cuál va destacado).
 */
export const getDashboardConfig = (business: Business) => {
  const model = business.income_model ?? 'mixed';
  return {
    // Backwards-compat: siempre true ahora.
    showStockKPI: true,
    showHoursKPI: true,

    // Nuevo: cuál KPI va destacado (cuando detail_level='detailed').
    emphasizeStock: model === 'products',
    emphasizeHours: model === 'services',
    showSplitRevenue: model === 'mixed',

    // Copy/icono del botón principal según modelo (sin cambios vs F0-2).
    saleButtonLabel:
      model === 'services' ? 'Cobrar servicio' :
      model === 'products' ? 'Registrar venta' : 'Nueva venta',
    saleButtonIcon:
      model === 'services' ? '🔧' :
      model === 'products' ? '📦' : '✨',

    costCategories: getCostCategories(model),
  };
};

const getCostCategories = (model: IncomeModel): string[] => {
  const service = ['Horas trabajadas', 'Herramientas', 'Traslado', 'Capacitación'];
  const product = ['Mercadería', 'Stock', 'Flete de compra', 'Packaging'];
  const common  = ['Alquiler', 'Servicios públicos', 'Impuestos', 'Otro costo'];
  if (model === 'services') return [...service, ...common];
  if (model === 'products') return [...product, ...common];
  return [...service, ...product, ...common];
};
