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

/** D-6: 'year' se suma para la pantalla Stats (comparativas anuales).
 *  El dashboard sigue ofreciendo solo day/week/month en su selector. */
export type Period = 'day' | 'week' | 'month' | 'year';

/**
 * F1-M Fase B — período del selector temporal de MiPlataCard.
 * Distinto de Period (que es flow para Ingresos/Costos):
 *   - Period      → rango de actividad ("¿cuánto entró del 1 al 30?")
 *   - StockPeriod → snapshot vs comparativa ("¿cuánto tengo HOY vs hace 7 días?")
 * No hay 'day' porque "Hoy" cubre ese caso y no tiene sentido un snapshot diario.
 */
export type StockPeriod = 'today' | 'week' | 'month' | 'year';

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

/**
 * F1-M Fase B (refactor B5) — rangos para la variación neta del período.
 *
 * Tras feedback CEO 2026-06-09, MiPlata pasó de "snapshot stock con asOf" a
 * "variación neta del período (flow por cuenta)". Por eso ahora son rangos
 * `[start, end]` en lugar de un punto único `asOf`.
 *
 *   start, end         → rango de movimientos que componen la variación.
 *   prevStart, prevEnd → rango equivalente del período anterior para comparativa.
 *
 * Reglas por chip:
 *   today → [hoy, hoy]                 prev = [ayer, ayer]
 *   week  → [lunes esta sem, hoy]      prev = [lunes sem ant, domingo ant]
 *   month → [día 1 mes, hoy]           prev = [día 1 mes ant, fin mes ant]
 *   year  → [1 ene año, hoy]           prev = [1 ene año ant, 31 dic año ant]
 */
export type StockPeriodRange = {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  label: string;
  prevLabel: string;
};

/**
 * Convierte Date a 'YYYY-MM-DD' usando timezone local (no UTC).
 *
 * Exportada (Bug B fix) para que SaleForm/CostForm/MovementForm/QuickHoursForm
 * y los repos que arman rangos de mes la usen en lugar de
 * `new Date().toISOString().split('T')[0]`, que devuelve UTC y corre el día
 * en horarios cercanos a medianoche (en BA UTC-3, después de las 21:00 local
 * ya estamos en el día siguiente UTC).
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Atajo: el día de hoy del dispositivo en formato 'YYYY-MM-DD'. */
export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

/**
 * Inversa de `toLocalISODate`: 'YYYY-MM-DD' → Date a medianoche LOCAL.
 *
 * NO usar `new Date('YYYY-MM-DD')` — el constructor interpreta ese formato
 * como UTC y en BA (UTC-3) devuelve el día anterior a las 21:00. Mismo bug
 * que LESSONS #2 pero en la dirección de lectura.
 */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * D-23.a — Desplaza un ancla de mes `n` meses (n negativo = atrás) y devuelve
 * el día 1 del mes resultante en 'YYYY-MM-DD'. Usado por la navegación de mes
 * del calendario (chevrons ‹ ›). Construido con el constructor LOCAL (no UTC)
 * para no reintroducir LESSONS #2; el día 1 evita el overflow clásico de
 * "31 de marzo − 1 mes" (Date normaliza al alta del mes anterior si el día no
 * existe, por eso anclamos al 1).
 */
export function shiftMonthISO(anchorISO: string, n: number): string {
  const d = parseLocalISODate(anchorISO);
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

// Alias local para no cambiar los usos internos del módulo.
const toISODate = toLocalISODate;

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
    case 'year': {
      // D-6 — año calendario completo vs año anterior completo.
      const y = today.getFullYear();
      return {
        start: toISODate(new Date(y, 0, 1)),
        end: toISODate(new Date(y, 11, 31)),
        prevStart: toISODate(new Date(y - 1, 0, 1)),
        prevEnd: toISODate(new Date(y - 1, 11, 31)),
        label: String(y),
        prevLabel: String(y - 1),
      };
    }
  }
}

/**
 * F1-O / D-19 (calendario como filtro) — rango generalizado del dashboard.
 *
 * Generaliza `Period` (enum) a un rango arbitrario `[start, end]`: el calendario
 * permite seleccionar un día suelto o un rango custom (tap-tap), que el enum no
 * puede expresar. `kind` distingue de dónde vino para que el UI sincronice los
 * chips del SegmentedControl (D-19.b).
 *
 *   kind 'day'|'week'|'month' → vino de un chip; delega en getPeriodRange.
 *   kind 'custom'             → vino del calendario; prev = rango inmediatamente
 *                               anterior de IGUAL longitud (misma regla que
 *                               getPeriodRange para semana/mes).
 */
export type DashboardRange = {
  kind: 'day' | 'week' | 'month' | 'custom';
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  label: string;
  prevLabel: string;
};

/** Cantidad de días que cubre [start, end] inclusive. */
function rangeLengthDays(start: string, end: string): number {
  const ms = parseLocalISODate(end).getTime() - parseLocalISODate(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Label corto de un rango custom: "8–14 jun" / "28 may–3 jun" / "8 jun" (día). */
function customRangeLabel(start: string, end: string): string {
  const s = parseLocalISODate(start);
  const e = parseLocalISODate(end);
  const shortMonth = (d: Date) =>
    d.toLocaleString('es-AR', { month: 'short' }).replace('.', '');
  if (start === end) return `${s.getDate()} ${shortMonth(s)}`;
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth
    ? `${s.getDate()}–${e.getDate()} ${shortMonth(e)}`
    : `${s.getDate()} ${shortMonth(s)}–${e.getDate()} ${shortMonth(e)}`;
}

/**
 * Resuelve un `DashboardRange` desde un chip (Period) o un rango custom del
 * calendario. Los chips delegan en `getPeriodRange` (cero duplicación de lógica
 * ni de timezone); el custom calcula su comparativa por longitud.
 *
 * 'year' (solo Stats) cae en kind 'custom' — el dashboard no lo ofrece, pero
 * tipar el caso evita que un caller lo rompa.
 */
export function resolveRange(
  input: Period | { start: string; end: string },
  anchor: Date = new Date(),
): DashboardRange {
  if (typeof input === 'string') {
    const r = getPeriodRange(input, anchor);
    return {
      kind: input === 'year' ? 'custom' : input,
      start: r.start,
      end: r.end,
      prevStart: r.prevStart,
      prevEnd: r.prevEnd,
      label: r.label,
      prevLabel: r.prevLabel,
    };
  }

  const { start, end } = input;
  const len = rangeLengthDays(start, end);
  const prevEnd = toISODate(addDays(parseLocalISODate(start), -1));
  const prevStart = toISODate(addDays(parseLocalISODate(prevEnd), -(len - 1)));
  return {
    kind: 'custom',
    start,
    end,
    prevStart,
    prevEnd,
    label: customRangeLabel(start, end),
    prevLabel: 'período anterior',
  };
}

/**
 * F1-M Fase B (refactor B5) — calcula el rango [start, end] + el rango
 * equivalente del período anterior para la variación neta del MiPlataCard.
 *
 * El "período anterior" usa una longitud comparable, no rolling exacto:
 *   - week: lunes a domingo de la semana pasada (no -7d rolling).
 *   - month: día 1 a último día del mes pasado.
 *   - year: 1 ene a 31 dic del año pasado.
 *
 * Esto permite que "Mes" muestre la variación de junio entero y la compare
 * contra la variación de mayo entero (homogéneo), no contra "hace 30 días".
 */
export function getStockPeriodRange(
  stockPeriod: StockPeriod,
  anchor: Date = new Date(),
): StockPeriodRange {
  const today = new Date(anchor);
  today.setHours(0, 0, 0, 0);

  switch (stockPeriod) {
    case 'today': {
      const yesterday = addDays(today, -1);
      return {
        start: toISODate(today),
        end: toISODate(today),
        prevStart: toISODate(yesterday),
        prevEnd: toISODate(yesterday),
        label: 'Hoy',
        prevLabel: 'ayer',
      };
    }
    case 'week': {
      // ISO week: lunes = 1 ... domingo = 7
      const dayOfWeek = today.getDay() || 7;
      const monday = addDays(today, -(dayOfWeek - 1));
      const prevMonday = addDays(monday, -7);
      const prevSunday = addDays(monday, -1);
      return {
        start: toISODate(monday),
        end: toISODate(today),
        prevStart: toISODate(prevMonday),
        prevEnd: toISODate(prevSunday),
        label: 'Semana',
        prevLabel: 'semana pasada',
      };
    }
    case 'month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const prevFirstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      // Day 0 del mes actual = último día del mes anterior.
      const prevLastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: toISODate(firstDay),
        end: toISODate(today),
        prevStart: toISODate(prevFirstDay),
        prevEnd: toISODate(prevLastDay),
        label: 'Mes',
        prevLabel: 'mes pasado',
      };
    }
    case 'year': {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const prevFirstDay = new Date(today.getFullYear() - 1, 0, 1);
      const prevLastDay = new Date(today.getFullYear() - 1, 11, 31);
      return {
        start: toISODate(firstDay),
        end: toISODate(today),
        prevStart: toISODate(prevFirstDay),
        prevEnd: toISODate(prevLastDay),
        label: 'Año',
        prevLabel: 'año pasado',
      };
    }
  }
}
