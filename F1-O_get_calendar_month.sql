-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-O / D-19 — RPC `get_calendar_month` (calendario como filtro)       ║
-- ║  Junio 2026 · Fase 1 (SOLO PLATA)                                      ║
-- ║                                                                        ║
-- ║  Por qué existe:                                                       ║
-- ║   El widget <CalendarMonth/> necesita el MES CALENDARIO COMPLETO,      ║
-- ║   independiente del filtro de período activo (si el usuario filtra     ║
-- ║   "hoy", los puntos del resto del mes no pueden desaparecer). Es UNA    ║
-- ║   query agregada por fecha — no N queries por día.                     ║
-- ║                                                                        ║
-- ║  Diseño:                                                               ║
-- ║   - SECURITY INVOKER → corre como el usuario, la RLS de `transactions` ║
-- ║     aplica. Aunque se pase un business ajeno, devuelve vacío.          ║
-- ║   - Excluye `*_extraordinary` (cuenta lo MISMO que las cards del       ║
-- ║     dashboard o miente — ADR #20, paridad con buildFlowBlock).         ║
-- ║   - Excluye días futuros (date > hoy): cero plata en el futuro a nivel ║
-- ║     de datos, no solo de UI (defensa en profundidad de ADR #20).       ║
-- ║                                                                        ║
-- ║  Fase 1 = SOLO PLATA. `orders_count` por día entra en Fase 2 (cuando   ║
-- ║  exista la tabla `orders`) extendiendo esta misma función. No se       ║
-- ║  referencia `orders` acá a propósito: una función LANGUAGE sql valida  ║
-- ║  sus referencias al crearse y `orders` todavía no existe.              ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'get_calendar_month';  -- 0 filas


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Índice de soporte de la agregación
-- ─────────────────────────────────────────────────────────────────────────
-- IF NOT EXISTS: si ya hay un índice equivalente por (business_id, date) con
-- otro nombre, podés saltear este paso. A la escala actual el costo es nulo.
CREATE INDEX IF NOT EXISTS transactions_business_date_idx
  ON public.transactions(business_id, date);


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Función agregada del mes
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_calendar_month(
  p_business_id UUID,
  p_anchor      DATE
)
RETURNS TABLE (date DATE, income NUMERIC, expense NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('month', p_anchor)::date AS m_start,
      (date_trunc('month', p_anchor) + interval '1 month' - interval '1 day')::date AS m_end
  )
  SELECT
    t.date,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'),  0) AS income,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expense
  FROM public.transactions t, bounds b
  WHERE t.business_id = p_business_id
    AND t.date BETWEEN b.m_start AND b.m_end
    AND t.type IN ('income', 'expense')   -- excluye *_extraordinary
    AND t.date <= CURRENT_DATE            -- ADR #20: nada de plata en el futuro
  GROUP BY t.date;
$$;

-- Supabase expone RPC a los roles autenticados solo si tienen EXECUTE.
GRANT EXECUTE ON FUNCTION public.get_calendar_month(UUID, DATE) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST (correr después de aplicar — LESSONS #6)
-- ─────────────────────────────────────────────────────────────────────────
-- Debe devolver 1 fila ('get_calendar_month'):
--   SELECT proname FROM pg_proc WHERE proname = 'get_calendar_month';
--
-- Smoke test — toma el primer business automáticamente (sin copiar/pegar UUID).
-- Si querés uno puntual: SELECT id, name FROM public.businesses; y reemplazá el
-- subselect por 'tu-uuid' (entre comillas, SIN los < >):
--   SELECT * FROM public.get_calendar_month(
--     (SELECT id FROM public.businesses ORDER BY created_at LIMIT 1),
--     CURRENT_DATE
--   ) ORDER BY date;
--
-- Control de paridad — total del mes vía RPC vs suma directa (deben coincidir;
-- si difieren, hay un filtro mal):
--   WITH b AS (SELECT id FROM public.businesses ORDER BY created_at LIMIT 1)
--   SELECT
--     (SELECT COALESCE(SUM(income),0) FROM public.get_calendar_month((SELECT id FROM b), CURRENT_DATE)) AS rpc_income,
--     (SELECT COALESCE(SUM(amount),0) FROM public.transactions
--        WHERE business_id = (SELECT id FROM b) AND type = 'income'
--          AND date BETWEEN date_trunc('month', CURRENT_DATE)::date AND CURRENT_DATE) AS direct_income;
