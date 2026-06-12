/**
 * eventsRepo — telemetría mínima de producto (F1-N).
 *
 * Por qué existe:
 *   El DoD de F1 exige D7 retention ≥ 30% y onboarding < 2 min. Sin eventos
 *   instrumentados esas métricas no se pueden medir — el beta test no produce
 *   el número que decide pasar a F2. Esto es lo mínimo: 4 eventos a una tabla
 *   `app_events` en Supabase. El análisis vive en SQL Editor (queries listas
 *   en F1-N_app_events_migration.sql). PostHog/Sentry pueden venir en F2.
 *
 * Reglas de diseño:
 *   1. FIRE-AND-FORGET. `track()` no devuelve Promise y nunca tira — la
 *      telemetría jamás bloquea ni rompe la UX. Si el insert falla (RLS,
 *      red, migration sin aplicar), se loguea un warn y la app sigue.
 *   2. Sin PII en `props`. business_id ya identifica; no guardar montos
 *      exactos, emails ni descripciones (amount NO va en props a propósito).
 *   3. Nombres de evento cerrados en el union `AppEventName` — typo en el
 *      nombre = error de compilación, no una métrica fantasma en la tabla.
 *
 * Analogía C++: un logger asíncrono con queue propia — el caller hace
 * `log()` y sigue; nunca espera el flush ni le importa si falló.
 */

import { supabase } from '../lib/supabase';

export type AppEventName =
  | 'session_start'          // boot con sesión válida o login exitoso
  | 'onboarding_completed'   // usuario terminó el onboarding
  | 'transaction_created'    // venta/costo/movimiento creado (props: type, category, settled)
  | 'transaction_settled'    // pendiente marcado como cobrado/pagado
  | 'hint_tap'               // D-5: tap en hint contextual (props: key) — mide si la anticipación sirve
  | 'calendar_filter';       // F1-O/D-19: filtro por calendario (props: kind 'day'|'range') — sin fechas ni montos

export const eventsRepo = {
  /**
   * Registra un evento de producto. Fire-and-forget: no await-ear.
   * `props` debe ser serializable a JSON y sin datos sensibles.
   */
  track(
    businessId: string,
    event: AppEventName,
    props?: Record<string, string | number | boolean | null>,
  ): void {
    if (!businessId) return;
    void supabase
      .from('app_events')
      .insert({ business_id: businessId, event, props: props ?? null })
      .then(({ error }) => {
        if (error) {
          // Solo warn — la telemetría nunca es un error de cara al usuario.
          console.warn('[repo:events] track falló:', event, error.message);
        }
      });
  },
};
