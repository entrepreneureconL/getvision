-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-N — Telemetría mínima: tabla `app_events`                          ║
-- ║  Junio 2026                                                            ║
-- ║                                                                        ║
-- ║  Por qué existe:                                                       ║
-- ║   El DoD de F1 exige D7 retention ≥ 30% y onboarding < 2 min, pero     ║
-- ║   no había NINGÚN evento instrumentado — imposible medir la métrica    ║
-- ║   que decide pasar a F2. Esta tabla es el mínimo para responder:       ║
-- ║   ¿quién volvió?, ¿cuándo?, ¿qué cargó?, ¿cuánto tardó el onboarding?  ║
-- ║                                                                        ║
-- ║  Diseño:                                                               ║
-- ║   - Una fila por evento. Sin updates, sin deletes (append-only).       ║
-- ║   - `props` JSONB para contexto variable (type de transaction, etc).   ║
-- ║   - RLS owner igual que el resto de las tablas: el usuario solo ve     ║
-- ║     (y escribe) eventos de su propio business.                         ║
-- ║   - El análisis se hace acá en SQL Editor (queries abajo), no en la    ║
-- ║     app. PostHog/Sentry pueden venir en F2 — esto ya acumula history.  ║
-- ║                                                                        ║
-- ║  Eventos que emite la app (src/repos/events.ts):                       ║
-- ║   session_start          al resolver sesión (boot con sesión o login)  ║
-- ║   onboarding_completed   al completar el onboarding                    ║
-- ║   transaction_created    al crear venta/costo/movimiento (props: type, ║
-- ║                          category, settled)                            ║
-- ║   transaction_settled    al marcar cobrado/pagado un pendiente         ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT to_regclass('public.app_events') AS app_events_exists;  -- debería ser NULL


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Tabla
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event        VARCHAR(40) NOT NULL,
  props        JSONB NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT now()   -- UTC (default Supabase)
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_events_owner ON public.app_events;
CREATE POLICY app_events_owner ON public.app_events
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Índice para las queries de métricas (agrupan por business + event + día).
CREATE INDEX IF NOT EXISTS app_events_business_event_idx
  ON public.app_events(business_id, event, created_at);


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST (correr después de aplicar — LESSONS #6)
-- ─────────────────────────────────────────────────────────────────────────
-- Debe devolver 'public.app_events':
--   SELECT to_regclass('public.app_events');
-- Debe devolver 1 fila (app_events_owner):
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'app_events';


-- ═════════════════════════════════════════════════════════════════════════
-- QUERIES DE MÉTRICAS (copiar/pegar en SQL Editor cuando haya datos)
-- Nota timezone: created_at es UTC. Para cortes por día argentino usar
--   (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
-- ═════════════════════════════════════════════════════════════════════════

-- ── DAU: businesses activos por día ──────────────────────────────────────
-- SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia,
--        COUNT(DISTINCT business_id) AS activos
-- FROM public.app_events
-- WHERE event = 'session_start'
-- GROUP BY 1 ORDER BY 1 DESC;

-- ── D7 retention (la métrica norte de F1: threshold ≥ 30%) ──────────────
-- Cohorte = primer session_start de cada business. Retenido = tiene algún
-- session_start entre el día 7 y el día 13 post-primera sesión (ventana
-- semanal estándar, evita penalizar al que vuelve el día 8).
-- WITH first_seen AS (
--   SELECT business_id,
--          MIN((created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS d0
--   FROM public.app_events
--   WHERE event = 'session_start'
--   GROUP BY business_id
-- ),
-- retained AS (
--   SELECT f.business_id
--   FROM first_seen f
--   JOIN public.app_events e
--     ON e.business_id = f.business_id
--    AND e.event = 'session_start'
--    AND (e.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
--        BETWEEN f.d0 + 7 AND f.d0 + 13
--   GROUP BY f.business_id
-- )
-- SELECT COUNT(*) AS cohorte,
--        (SELECT COUNT(*) FROM retained) AS retenidos,
--        ROUND(100.0 * (SELECT COUNT(*) FROM retained) / NULLIF(COUNT(*), 0), 1) AS d7_pct
-- FROM first_seen
-- WHERE d0 <= CURRENT_DATE - 7;   -- solo businesses con ventana D7 ya abierta

-- ── Duración del onboarding (target F1-H: < 2 min) ──────────────────────
-- WITH t AS (
--   SELECT business_id,
--          MIN(created_at) FILTER (WHERE event = 'session_start')        AS first_session,
--          MIN(created_at) FILTER (WHERE event = 'onboarding_completed') AS onboarded
--   FROM public.app_events
--   GROUP BY business_id
-- )
-- SELECT business_id,
--        EXTRACT(EPOCH FROM (onboarded - first_session)) / 60.0 AS minutos
-- FROM t
-- WHERE onboarded IS NOT NULL
-- ORDER BY minutos DESC;

-- ── Cargas por business por semana (señal de hábito) ────────────────────
-- SELECT business_id,
--        date_trunc('week', created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS semana,
--        COUNT(*) FILTER (WHERE event = 'transaction_created') AS cargas,
--        COUNT(*) FILTER (WHERE event = 'transaction_settled') AS settles
-- FROM public.app_events
-- GROUP BY 1, 2 ORDER BY 2 DESC, 3 DESC;
