/**
 * periods.ts — utilidades de rango de fechas para hero metric.
 *
 * El SegmentedControl del Dashboard (F1-D) cambia entre Día / Semana / Mes.
 * Cada uno necesita saber:
 *   - El rango actual (start, end) para calcular la métrica.
 *   - El rango anterior (prevStart, prevEnd) para la comparativa "vs período ant".
 *   - Etiquetas legibles para el usuario.
 *
 * Convenciones:
 *   - Fechas como string 'YYYY-MM-DD' (formato Supabase).
 *   - Semana = lunes a domingo (ISO 8601).
 *   - Mes = primer a último día del mes calendario.
 *   - Día = solo hoy (start === end).
 *
 * Cuidado con timezones: NO usamos `toISOString()` porque convierte a UTC y
 * puede correr el día. Formateamos manualmente desde getFullYear/Month/Date,
 * que respeta la timezone local del dispositivo.
 *
 * Analogía Python: como `datetime.date.today()` + `relativedelta`. Acá vivimos
 * sin librería (date-fns / dayjs) para no inflar el bundle por algo simple.
 */

export type Period = 'day' | 'week' | 'month';

export type PeriodRange = {
  /** Rango actual. */
  start: string;
  end: string;
  /** Rango inmediatamente anterior, del mismo largo. */
  prevStart: string;
  prevEnd: string;
  /** Etiqueta corta para mostrar al usuario. */
  label: string;
  /** Etiqueta del período anterior para la comparativa. */
  prevLabel: string;
};

/** Convierte Date a 'YYYY-MM-DD' usando timezone local (no UTC). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve un Date nuevo con `n` días sumados (n puede ser negativo). */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Mes con primera letra mayúscula. "junio 2026" → "Junio 2026". */
function monthLabel(d: Date): string {
  const raw = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Calcula el rango de un período + el anterior comparable.
 *
 * Ejemplos (anchor = 2026-06-07 sábado):
 *   day   → start=end=2026-06-07,  prev=2026-06-06
 *   week  → 2026-06-01 a 2026-06-07, prev = 2026-05-25 a 2026-05-31
 *   month → 2026-06-01 a 2026-06-30, prev = 2026-05-01 a 2026-05-31
 */
export function getPeriodRange(
  period: Period,
  anchor: Date = new Date(),
): PeriodRange {
  const today = new Date(anchor);
  today.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day': {
      const prev = addDays(today, -1);
      return {
        start: toISODate(today),
        end: toISODate(today),
        prevStart: toISODate(prev),
        prevEnd: toISODate(prev),
        label: 'Hoy',
        prevLabel: 'Ayer',
      };
    }
    case 'week': {
      // ISO week: domingo = 7 (no 0), lunes = 1.
      const dayOfWeek = today.getDay() || 7;
      const monday = addDays(today, -(dayOfWeek - 1));
      const sunday = addDays(monday, 6);
      const prevMonday = addDays(monday, -7);
      const prevSunday = addDays(monday, -1);
      return {
        start: toISODate(monday),
        end: toISODate(sunday),
        prevStart: toISODate(prevMonday),
        prevEnd: toISODate(prevSunday),
        label: 'Esta semana',
        prevLabel: 'Semana pasada',
      };
    }
    case 'month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const prevFirstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevLastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: toISODate(firstDay),
        end: toISODate(lastDay),
        prevStart: toISODate(prevFirstDay),
        prevEnd: toISODate(prevLastDay),
        label: monthLabel(firstDay),
        prevLabel: monthLabel(prevFirstDay),
      };
    }
  }
}
