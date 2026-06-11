/**
 * anticipation.ts — Anticipación nivel 1 (D-5, GETVISION_DESIGN §6).
 *
 * Reglas ESTÁTICAS por hora/día + señales que la app ya tiene cargadas.
 * Sin ML, sin queries extra, sin promesas que no podemos cumplir. El nivel 2
 * (resumen semanal proactivo) y el 3 (predicción real) vienen en fases
 * posteriores con historial suficiente.
 *
 * Principio §2.5 del doc de diseño: anticipar SIN invadir — todo hint es
 * descartable con un tap y nunca bloquea el camino manual. Si ninguna regla
 * aplica, NO hay hint (no inventamos urgencia).
 *
 * Funciones puras: reciben contexto, devuelven datos. La UI decide cómo
 * mostrarlos. Testeables pasando `now` fijo.
 */

export type HintAction = 'open_sale' | 'open_picker' | 'switch_week';

export type ContextualHint = {
  /** Key estable — para descartar ("no me muestres este de nuevo hoy") y telemetría. */
  key: string;
  text: string;
  actionLabel: string;
  action: HintAction;
};

type HintContext = {
  /** Inyectable para tests. Default: ahora. */
  now?: Date;
  /** ¿El usuario ya registró algo HOY? (de recentTransactions, sin query extra). */
  hasTransactionsToday: boolean;
};

/**
 * Devuelve el hint para el momento actual, o null (la mayoría del tiempo).
 *
 * Reglas v1 (orden = prioridad):
 *   1. Viernes ≥ 15h o sábado → invitación a revisar la semana (la gente
 *      revisa sus finanzas el fin de semana — investigación §3.2 del doc).
 *   2. Lunes < 12h sin registros hoy → arranque de semana.
 *   3. Cualquier día 19-23h sin registros hoy → cierre del día.
 */
export function getContextualHint(ctx: HintContext): ContextualHint | null {
  const now = ctx.now ?? new Date();
  const day = now.getDay();   // 0 = domingo ... 6 = sábado
  const hour = now.getHours();

  if ((day === 5 && hour >= 15) || day === 6) {
    return {
      key: 'week_review',
      text: 'Se cierra la semana — mirá cómo te fue.',
      actionLabel: 'Ver semana',
      action: 'switch_week',
    };
  }

  if (day === 1 && hour < 12 && !ctx.hasTransactionsToday) {
    return {
      key: 'week_start',
      text: 'Arrancó la semana. ¿Primera venta?',
      actionLabel: 'Cargar venta',
      action: 'open_sale',
    };
  }

  if (hour >= 19 && hour <= 23 && !ctx.hasTransactionsToday) {
    return {
      key: 'day_close',
      text: 'Todavía no cargaste nada hoy.',
      actionLabel: 'Cargar ahora',
      action: 'open_picker',
    };
  }

  return null;
}

/**
 * D-5 — orden del picker del FAB según frecuencia de uso reciente.
 *
 * IMPORTANTE (F1-K.2, decisión CEO 2026-06-10): el picker es genérico para
 * todos — SIEMPRE modo pedagógico, nada se esconde ni se compacta. Esta
 * función solo decide el ORDEN de las acciones primarias: si el usuario
 * registra más costos que ventas, "Pagar" sube arriba. Default: ventas
 * primero (el caso típico del negocio que cobra).
 *
 * Señal: las transactions recientes ya cargadas en el Dashboard (sin query
 * extra). Con menos de 5 movimientos no hay señal — orden default.
 */
export function shouldShowCostsFirst(
  recent: ReadonlyArray<{ type: string }>,
): boolean {
  if (recent.length < 5) return false;
  const incomes = recent.filter(t => t.type === 'income').length;
  const expenses = recent.filter(t => t.type === 'expense').length;
  return expenses > incomes;
}
