/**
 * heroMetrics.ts — definición de las métricas hero y su asignación por subrubro.
 *
 * Las 6 métricas disponibles en F0:
 *   - effective_hourly_rate    "¿Cuánto te rinde cada hora?"
 *   - daily_revenue            "¿Cuánto facturás un día promedio?"
 *   - ticket_average           "¿Cuánto te paga en promedio cada cliente?"
 *   - margin_per_sale          "¿Cuánta plata neta te queda por venta?"
 *   - cost_to_revenue_ratio    "¿Qué proporción de ingresos se va en costos?"
 *   - monthly_balance          "¿Cuánto te quedó neto este mes?" (fallback)
 *
 * El mapa HERO_METRICS_BY_SUBRUBRO decide qué métrica usar según el subrubro.
 * Si el usuario no tiene subrubro, cae al hero del rubro padre (HERO_METRICS_BY_RUBRO).
 * Si ni siquiera tiene rubro, cae a monthly_balance.
 */

export type HeroMetricKey =
  | 'effective_hourly_rate'
  | 'daily_revenue'
  | 'ticket_average'
  | 'margin_per_sale'
  | 'cost_to_revenue_ratio'
  | 'monthly_balance';

/**
 * Spec de cada métrica para la UI: label corto, label largo (tooltip),
 * formato del valor, unidad sufijo.
 */
export type HeroMetricSpec = {
  key: HeroMetricKey;
  label: string;              // "Tu hora rinde"
  longLabel: string;          // "Valor efectivo de tu hora trabajada"
  unit: 'currency' | 'currency_per_day' | 'currency_per_hour' | 'percent' | 'number';
  /** Mensaje constructivo que aparece debajo del número.
   *  Función porque depende del valor (positivo/negativo/cero/parcial). */
  buildHint: (ctx: HintContext) => string;
};

export type HintContext = {
  value: number;
  isPartial: boolean;     // faltan datos (e.g., hay ventas pero no horas)
  isEmpty: boolean;       // sin datos suficientes
  trend?: 'up' | 'down' | 'flat';  // futuro: comparativa mes anterior
};

/** Specs completos de las 6 métricas. */
export const HERO_METRICS: Record<HeroMetricKey, HeroMetricSpec> = {
  effective_hourly_rate: {
    key: 'effective_hourly_rate',
    label: 'Tu hora rinde',
    longLabel: 'Valor efectivo de tu hora trabajada (resultado neto ÷ horas)',
    unit: 'currency_per_hour',
    buildHint: ({ value, isPartial, isEmpty }) => {
      if (isEmpty) return 'Cargá tus horas trabajadas y ventas del mes para verlo.';
      if (isPartial) return 'Falta cargar horas trabajadas. El valor mostrado es solo tu balance.';
      if (value <= 0) return 'Este mes los costos superan los ingresos. Revisá tus mayores gastos.';
      if (value < 500) return 'Tu hora rinde poco. Revisá precios y horas no facturables.';
      return 'Subí tu tarifa un 10% — los clientes leales lo aceptan más de lo que pensás.';
    },
  },

  daily_revenue: {
    key: 'daily_revenue',
    label: 'Rinde por día',
    longLabel: 'Ingreso promedio por día con al menos una venta',
    unit: 'currency_per_day',
    buildHint: ({ value, isEmpty }) => {
      if (isEmpty) return 'Registrá tus ventas del mes para ver tu rendimiento diario.';
      if (value <= 0) return 'Sin ingresos este mes. Cargá las ventas que tengas.';
      return 'Mirá qué día rinde más — abrir solo esos días puede aumentar tu margen.';
    },
  },

  ticket_average: {
    key: 'ticket_average',
    label: 'Ticket promedio',
    longLabel: 'Importe promedio por cliente atendido',
    unit: 'currency',
    buildHint: ({ value, isEmpty }) => {
      if (isEmpty) return 'Registrá tus ventas para ver cuánto te paga cada cliente.';
      if (value <= 0) return 'Sin ventas registradas este mes.';
      return 'Sumá un producto adicional al servicio principal — sube ticket sin sumar clientes.';
    },
  },

  margin_per_sale: {
    key: 'margin_per_sale',
    label: 'Margen por venta',
    longLabel: 'Ganancia neta promedio que te deja cada venta (precio − costo)',
    unit: 'currency',
    buildHint: ({ value, isPartial, isEmpty }) => {
      if (isEmpty) return 'Cargá productos con costo unitario para ver tu margen real.';
      if (isPartial) return 'Algunos productos no tienen costo cargado. El margen mostrado es parcial.';
      if (value <= 0) return 'Vendés a pérdida. Revisá precios o renegociá con proveedores.';
      return 'Identificá tu producto con mejor margen y promovelo más.';
    },
  },

  cost_to_revenue_ratio: {
    key: 'cost_to_revenue_ratio',
    label: 'Costos / Ingresos',
    longLabel: 'Porcentaje de ingresos que se va en costos del mes',
    unit: 'percent',
    buildHint: ({ value, isEmpty }) => {
      if (isEmpty) return 'Cargá ingresos y costos para ver el ratio.';
      if (value >= 100) return 'Costos superan ingresos. Revisá los rubros que más gastan.';
      if (value >= 80)  return 'Margen apretado. Identificá los 3 costos más grandes y atacalos.';
      if (value <= 30)  return 'Excelente eficiencia. Considerá reinvertir en crecimiento.';
      return 'Ratio sano. Mantenelo estable mientras escalás ingresos.';
    },
  },

  monthly_balance: {
    key: 'monthly_balance',
    label: 'Resultado del mes',
    longLabel: 'Ingresos menos costos del mes en curso',
    unit: 'currency',
    buildHint: ({ value, isEmpty }) => {
      if (isEmpty) return 'Sin movimientos registrados este mes.';
      if (value > 0) return 'Este mes te quedaron a favor. Sumá horas trabajadas para ver cuánto te rinde el negocio por hora.';
      if (value < 0) return 'Los costos superaron los ingresos. Revisá tus mayores gastos abajo.';
      return 'Mes parejo. Probá agregar más detalle en tus ventas para entender qué pasó.';
    },
  },
};

/**
 * Mapa SUBRUBRO → HeroMetricKey.
 * Las claves son strings exactos de SUBRUBROS (case-sensitive).
 * Si un subrubro no está acá, se cae al rubro padre vía HERO_METRICS_BY_RUBRO.
 */
export const HERO_METRICS_BY_SUBRUBRO: Record<string, HeroMetricKey> = {
  // ───── SERVICES > Belleza y Estética ─────
  'Peluquería':                       'effective_hourly_rate',
  'Barbería':                         'effective_hourly_rate',
  'Manicura y Pedicura':              'effective_hourly_rate',
  'Spa y Masajes':                    'ticket_average',
  'Estética facial y corporal':       'ticket_average',
  'Tatuajes y Piercings':             'ticket_average',
  'Otra belleza':                     'effective_hourly_rate',

  // ───── SERVICES > Gastronomía ─────
  'Restaurant':                       'ticket_average',
  'Bar y Cafetería':                  'ticket_average',
  'Comida para llevar / Delivery':    'daily_revenue',
  'Catering para eventos':            'ticket_average',
  'Otra gastronomía':                 'ticket_average',

  // ───── SERVICES > Salud ─────
  'Consultorio médico':               'effective_hourly_rate',
  'Odontología':                      'effective_hourly_rate',
  'Kinesiología y Fisioterapia':      'effective_hourly_rate',
  'Psicología y Terapias':            'effective_hourly_rate',
  'Otra salud':                       'effective_hourly_rate',

  // ───── SERVICES > Gimnasio y Wellness ─────
  'Gimnasio':                         'monthly_balance',
  'Pilates / Yoga':                   'monthly_balance',
  'Crossfit / Funcional':             'monthly_balance',
  'Otros wellness':                   'monthly_balance',

  // ───── SERVICES > Educación y Formación ─────
  'Clases particulares':              'effective_hourly_rate',
  'Academia / Cursos':                'ticket_average',
  'Coaching profesional':             'effective_hourly_rate',
  'Otra educación':                   'effective_hourly_rate',

  // ───── SERVICES > Tecnología y Sistemas ─────
  'Desarrollo de software':           'effective_hourly_rate',
  'Soporte técnico':                  'effective_hourly_rate',
  'Diseño UX/UI':                     'effective_hourly_rate',
  'Otra tecnología':                  'effective_hourly_rate',

  // ───── SERVICES > Asesoramiento Profesional ─────
  'Contador / Impuestos':             'effective_hourly_rate',
  'Abogado':                          'effective_hourly_rate',
  'Consultor de negocios':            'effective_hourly_rate',
  'Otros profesionales':              'effective_hourly_rate',

  // ───── SERVICES > Transporte Pesado y Fletes ─────
  'Mudanzas':                         'daily_revenue',
  'Fletes y cargas':                  'daily_revenue',
  'Distribución':                     'daily_revenue',
  'Otro transporte pesado':           'daily_revenue',

  // ───── SERVICES > Transporte de Personas ─────
  'Apps de movilidad':                'effective_hourly_rate',
  'Remis / Taxi':                     'effective_hourly_rate',
  'Transfer / Turismo':               'ticket_average',
  'Otro transporte personas':         'effective_hourly_rate',

  // ───── SERVICES > Arte y Diseño ─────
  'Diseño gráfico / Ilustración':     'effective_hourly_rate',
  'Fotografía / Audiovisual':         'effective_hourly_rate',
  'Música / Producción':              'effective_hourly_rate',
  'Otro arte':                        'effective_hourly_rate',

  // ───── SERVICES > Construcción y Reformas ─────
  'Albañilería':                      'effective_hourly_rate',
  'Plomería':                         'effective_hourly_rate',
  'Electricidad':                     'effective_hourly_rate',
  'Pintura':                          'effective_hourly_rate',
  'Reformas integrales':              'daily_revenue',
  'Otro construcción':                'effective_hourly_rate',

  // ───── SERVICES > Taller Mecánico ─────
  'Mecánica general':                 'effective_hourly_rate',
  'Chapa y pintura':                  'effective_hourly_rate',
  'Electricidad automotriz':          'effective_hourly_rate',
  'Otro taller':                      'effective_hourly_rate',

  // ───── COMMERCE > Alimentos y Bebidas ─────
  'Kiosco':                           'daily_revenue',
  'Almacén / Despensa':               'daily_revenue',
  'Panadería':                        'daily_revenue',
  'Carnicería / Verdulería':          'daily_revenue',
  'Vinería / Distribuidora':          'daily_revenue',
  'Otro alimentos':                   'daily_revenue',

  // ───── COMMERCE > Indumentaria y Calzado ─────
  'Ropa adulto':                      'margin_per_sale',
  'Ropa infantil':                    'margin_per_sale',
  'Calzado':                          'margin_per_sale',
  'Indumentaria deportiva':           'margin_per_sale',
  'Otro indumentaria':                'margin_per_sale',

  // ───── COMMERCE > Electrónica y Tecnología ─────
  'Electrónica de consumo':           'margin_per_sale',
  'Insumos informáticos':             'margin_per_sale',
  'Telefonía y accesorios':           'margin_per_sale',
  'Otro electrónica':                 'margin_per_sale',

  // ───── COMMERCE > Hogar y Decoración ─────
  'Mueblería':                        'margin_per_sale',
  'Bazar / Decoración':               'margin_per_sale',
  'Textil hogar':                     'margin_per_sale',
  'Otro hogar':                       'margin_per_sale',

  // ───── COMMERCE > Farmacia y Salud ─────
  'Farmacia':                         'daily_revenue',
  'Ortopedia':                        'margin_per_sale',
  'Productos naturistas':             'margin_per_sale',
  'Otro farmacia':                    'daily_revenue',

  // ───── COMMERCE > Repuestos y Accesorios Automotrices ─────
  'Repuestos generales':              'margin_per_sale',
  'Lubricentros':                     'daily_revenue',
  'Accesorios y tuning':              'margin_per_sale',
  'Otro repuestos':                   'margin_per_sale',

  // ───── COMMERCE > Remisería y Agencia de Transporte (F0-9) ─────
  // Empresa con flota. KPI primario: rinde por día de operación.
  // En F1+ podríamos sumar revenue_per_vehicle cuando tengamos tabla de vehículos.
  'Remisería con flota':              'daily_revenue',
  'Agencia de transporte':            'daily_revenue',
  'Servicio de transfer corporativo': 'daily_revenue',
  'Otro flota':                       'daily_revenue',
};

/**
 * Fallback por rubro cuando no hay subrubro o el subrubro no está mapeado.
 * Cubre el caso de Ferretería y Librería que no tienen subrubros.
 */
export const HERO_METRICS_BY_RUBRO: Record<string, HeroMetricKey> = {
  // SERVICES
  'Belleza y Estética':               'effective_hourly_rate',
  'Gastronomía':                      'ticket_average',
  'Salud':                            'effective_hourly_rate',
  'Gimnasio y Wellness':              'monthly_balance',
  'Educación y Formación':            'effective_hourly_rate',
  'Tecnología y Sistemas':            'effective_hourly_rate',
  'Asesoramiento Profesional':        'effective_hourly_rate',
  'Transporte Pesado y Fletes':       'daily_revenue',
  'Transporte de Personas':           'effective_hourly_rate',
  'Arte y Diseño':                    'effective_hourly_rate',
  'Construcción y Reformas':          'effective_hourly_rate',
  'Taller Mecánico':                  'effective_hourly_rate',
  'Otro servicio':                    'effective_hourly_rate',

  // COMMERCE
  'Alimentos y Bebidas':              'daily_revenue',
  'Indumentaria y Calzado':           'margin_per_sale',
  'Electrónica y Tecnología':         'margin_per_sale',
  'Hogar y Decoración':               'margin_per_sale',
  'Ferretería y Materiales':          'margin_per_sale',
  'Farmacia y Salud':                 'daily_revenue',
  'Librería y Papelería':             'margin_per_sale',
  'Repuestos y Accesorios Automotrices': 'margin_per_sale',
  'Remisería y Agencia de Transporte': 'daily_revenue',  // F0-9
  'Otro comercio':                    'daily_revenue',

  // INDUSTRY (no es target — usamos cost_to_revenue_ratio salvo construcción)
  'Alimentos Elaborados':             'cost_to_revenue_ratio',
  'Textil y Confección':              'cost_to_revenue_ratio',
  'Metalurgia':                       'cost_to_revenue_ratio',
  'Química y Plásticos':              'cost_to_revenue_ratio',
  'Madera y Muebles':                 'cost_to_revenue_ratio',
  'Construcción':                     'monthly_balance',
  'Otra industria':                   'cost_to_revenue_ratio',

  // AGRO (mensaje honesto: métricas reales en futuro)
  'Agricultura':                      'monthly_balance',
  'Ganadería':                        'monthly_balance',
  'Avicultura':                       'cost_to_revenue_ratio',
  'Fruticultura':                     'monthly_balance',
  'Apicultura':                       'monthly_balance',
  'Otro agro':                        'monthly_balance',
};

/**
 * Resolver hero metric:
 *   1. Si hay subrubro y está en el mapa → usar ese.
 *   2. Si hay rubro y está en el mapa → usar ese.
 *   3. Fallback final → monthly_balance.
 */
export function resolveHeroMetric(
  rubro?: string | null,
  subrubro?: string | null,
): HeroMetricSpec {
  if (subrubro && HERO_METRICS_BY_SUBRUBRO[subrubro]) {
    return HERO_METRICS[HERO_METRICS_BY_SUBRUBRO[subrubro]];
  }
  if (rubro && HERO_METRICS_BY_RUBRO[rubro]) {
    return HERO_METRICS[HERO_METRICS_BY_RUBRO[rubro]];
  }
  return HERO_METRICS.monthly_balance;
}

/**
 * Bandera para mostrar nota especial cuando el rubro es agro.
 * Sirve al banner de transparencia: "Estamos diseñando métricas específicas para Agro..."
 */
export function isAgroRubro(sector?: string | null): boolean {
  return sector === 'agro';
}
