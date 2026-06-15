/**
 * Design Tokens — F1-D
 *
 * Fuente única de verdad para colores, espaciado, tipografía, radios y sombras.
 * Cualquier valor visual usado en la app debe venir de acá. Si necesitás un
 * valor que no existe, primero preguntate si no es señal de que falta un token.
 *
 * Filosofía (§13.1 del master):
 *   - Cero hex pelado en componentes. Usás `color.text.primary`, no `#F2F4F8`.
 *   - 8pt grid. Spacing en múltiplos de 4 (4, 8, 12, 16, 20, 24, 32...).
 *   - Tipografía escalada — el hero metric usa `text.size['4xl']`, no 40.
 *   - Una sola fuente para acento azul (`color.accent.base`) — si mañana lo
 *     cambiamos, cambia en todos lados sin grep.
 *
 * Analogía Python/web:
 *   - Equivalente a un módulo `constants.py` con namespaces, o a CSS variables
 *     (`--color-text-primary`). En RN no hay CSS vars nativas; el patrón es
 *     este objeto + `as const` para tipado literal.
 *
 * Convenciones de naming:
 *   - `base`     → el valor por defecto del token (color.accent.base)
 *   - `muted`    → versión apagada, para fondos/borders sutiles
 *   - `subtle`   → versión casi transparente (overlay tintado)
 *   - `hover`    → estado de interacción (pressed en mobile)
 *
 * Status: introducido en F1-D. Reemplazo gradual de hex inline en componentes.
 */

/* ─────────────────────────────────────────────────────────────
 * COLORES
 * ────────────────────────────────────────────────────────────
 * Inspiración: iPhone Screen Time + iCloud web. Fondo casi-negro
 * (no negro puro, evita el corte OLED-extremo), card un nivel
 * arriba en lugar de bordes visibles, acento azul iCloud-ish.
 */
export const color = {
  /** Superficies — el "altímetro" de la profundidad. base < raised < elevated. */
  bg: {
    /** Fondo principal de pantalla. */
    base: '#0A0E1A',
    /** Card sobre fondo. Visible por contraste, sin border. */
    raised: '#151B2C',
    /** Sub-card dentro de card (futuro: secciones con jerarquía). */
    elevated: '#1E263D',
    /** Backdrop de modal o popup. */
    overlay: 'rgba(0,0,0,0.6)',
  },

  /** Bordes — usar con moderación. Apple casi no usa bordes en mobile. */
  border: {
    /** Línea divisoria muy sutil dentro de listas. */
    subtle: '#1F2638',
    /** Border default de inputs / chips. */
    default: '#2A3349',
    /** Border destacado de selección. */
    strong: '#3A4561',
  },

  /** Texto — jerarquía por opacidad/luminancia, no por color. */
  text: {
    /** Texto principal: hero value, títulos, labels importantes. */
    primary: '#F2F4F8',
    /** Texto secundario: hints, labels de form, sub-info. */
    secondary: '#A6B0C2',
    /** Texto bajo: timestamps, captions, "updated at". */
    tertiary: '#6B7488',
    /** Deshabilitado / placeholder. */
    disabled: '#3F485A',
    /** Texto sobre superficie clara (botón primary con bg azul). */
    inverse: '#0A0E1A',
  },

  /** Acento principal — teal del logo GetVision (confirmado al ver los assets
   *  de marca en Diseño/Logo/). Es el color de la palabra "Get" + las montañas
   *  del isotipo. Reemplaza al azul iCloud inicial que habíamos decidido a
   *  ciegas. La paleta semántica abajo (success/danger) no cambia. */
  accent: {
    base: '#1F8579',
    /** Estado pressed/hover (10% más oscuro). */
    hover: '#176960',
    /** Variante apagada para badges/chips/disabled. */
    muted: '#0E423C',
    /** Background tintado muy sutil. */
    subtle: 'rgba(31,133,121,0.10)',
  },

  /** Verde "ingresos" — emerald (D-10, 2026-06-10). La paleta semántica migró
   *  de los flat-UI 2015 (#27AE60/#C0392B) a jewel tones: más luminosos sobre
   *  fondo oscuro y alineados al pairing emerald↔teal que la investigación
   *  2026 marca como tendencia fintech (GETVISION_DESIGN §3.2). El emerald
   *  además armoniza con el teal de marca #1F8579 (misma familia). */
  success: {
    base: '#10B981',
    hover: '#0D9668',
    muted: '#065F46',
    subtle: 'rgba(16,185,129,0.10)',
  },

  /** Rojo "egresos / alerta" — rose. Menos terroso que el #C0392B histórico,
   *  mejor contraste sobre bg.base sin gritar. */
  danger: {
    base: '#EF4444',
    hover: '#DC2626',
    muted: '#7F1D1D',
    subtle: 'rgba(239,68,68,0.10)',
  },

  /** Ámbar "atención" — métricas porcentuales y pendientes. */
  warning: {
    base: '#F59E0B',
    hover: '#D97706',
    muted: '#78350F',
    subtle: 'rgba(245,158,11,0.10)',
  },

  /** Violeta "info / count / PEDIDOS" — también el badge de pedidos del
   *  calendario (D-23.b): violeta para NO confundirse con el verde de ingresos. */
  info: {
    base: '#8B5CF6',
    hover: '#7C3AED',
    muted: '#4C1D95',
    subtle: 'rgba(139,92,246,0.10)',
  },

  /** Selección de día/rango/semana en el calendario (D-23.b, decisión CEO
   *  2026-06-13): slate azulado atenuado — NO el verde `accent.subtle`, que
   *  competía con los ingresos en el pantallazo rápido. */
  selection: {
    subtle: 'rgba(125,142,178,0.20)',
    strong: 'rgba(125,142,178,0.32)',
  },
} as const;

/* ─────────────────────────────────────────────────────────────
 * ESPACIADO (8pt grid)
 * ────────────────────────────────────────────────────────────
 * Naming numérico (1,2,3...) en lugar de t-shirt (sm,md,lg) porque
 * en spacing necesitamos granularidad fina sin inventar nombres.
 * Cada unidad = 4px. Así `space[4] = 16px` se lee como "4 unidades".
 */
export const space = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
} as const;

/* ─────────────────────────────────────────────────────────────
 * RADIOS
 * ────────────────────────────────────────────────────────────
 * iPhone Screen Time card usa ~16-20px. Inputs ~10px. Pills 999.
 */
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  pill: 9999,
} as const;

/* ─────────────────────────────────────────────────────────────
 * TIPOGRAFÍA
 * ────────────────────────────────────────────────────────────
 * Escala modular ~1.2x. Mobile-first.
 *
 * Mapeo a roles (ver Heading.tsx y Text.tsx):
 *   - display  → 4xl/5xl  → hero metric
 *   - h1       → 3xl      → títulos de pantalla
 *   - h2       → 2xl      → secciones grandes
 *   - h3       → xl       → subsecciones
 *   - h4       → lg       → títulos de card
 *   - body     → md       → párrafos
 *   - caption  → sm       → hints, sub-info
 *   - micro    → xs       → timestamps, badges
 */
export const text = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 36,
    '5xl': 44,
  },
  /** Line-height pareado con size (ratio ~1.3-1.4). */
  lineHeight: {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 24,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 44,
    '5xl': 52,
  },
  /** RN acepta "400"|"500"|... como string. Tipamos liberal. */
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /** Tracking. Display usa negativo (más compacto), micro usa positivo. */
  letterSpacing: {
    tighter: -0.8,
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
    widest: 1.2,
  },
} as const;

/* ─────────────────────────────────────────────────────────────
 * SOMBRAS
 * ────────────────────────────────────────────────────────────
 * En RN: shadowColor/Offset/Opacity/Radius (iOS) + elevation (Android).
 * En web RN traduce a box-shadow.
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

/* ─────────────────────────────────────────────────────────────
 * BREAKPOINTS (D-15)
 * ────────────────────────────────────────────────────────────
 * Un solo punto de quiebre por ahora: móvil/tablet (una columna,
 * bottom tabs) vs escritorio (grilla multi-columna, sidebar).
 * Fuente única — DashboardScreen y MainTabs leen de acá.
 */
export const breakpoint = {
  /** >= wide → layout escritorio (sidebar + columnas). */
  wide: 1100,
} as const;

/* ─────────────────────────────────────────────────────────────
 * BARREL — para imports cómodos
 * ────────────────────────────────────────────────────────────
 *   import { color, space } from '@/design/tokens';
 *   import tokens from '@/design/tokens';  // tokens.color.text.primary
 */
export const tokens = { color, space, radius, text, shadow } as const;
export default tokens;

/* ─────────────────────────────────────────────────────────────
 * TIPOS DERIVADOS — útiles para props tipadas en componentes
 * ────────────────────────────────────────────────────────────
 *   gap?: SpaceKey   // autocomplete "1"|"2"|"3"|"4"...
 *   variant: 'body'  // safe vía SizeKey
 */
export type ColorPath = string; // placeholder; en F1+ vamos a tipar paths anidados.
export type SpaceKey = keyof typeof space;
export type RadiusKey = keyof typeof radius;
export type SizeKey = keyof typeof text.size;
export type WeightKey = keyof typeof text.weight;
