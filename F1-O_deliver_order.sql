-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-O Etapa 2A.2 — RPC `deliver_order` + `get_calendar_month` v2       ║
-- ║  Junio 2026 · P-011 · plan F1-O_ETAPA2_PLAN.md (riesgos R1-R6)         ║
-- ║                                                                        ║
-- ║  ⚠ CÓMO APLICAR (importante — 2 incidentes con el SQL Editor):         ║
-- ║   El editor del dashboard rompe los cuerpos $...$ de funciones si      ║
-- ║   contienen comentarios o líneas en blanco (corta el statement e       ║
-- ║   inyecta cosas — errores 42601 vistos el 2026-06-12). Por eso:        ║
-- ║   1. Los cuerpos de las funciones van SIN comentarios NI líneas en     ║
-- ║      blanco — toda la explicación está AFUERA, acá arriba.             ║
-- ║   2. Correr CADA PASO en una query nueva del editor, por separado      ║
-- ║      (copiar/pegar solo el bloque del paso, sin los comentarios).      ║
-- ║                                                                        ║
-- ║  Qué hace deliver_order (todo o nada — R1):                            ║
-- ║   1. Valida fecha (viene del cliente: CURRENT_DATE del server es UTC,  ║
-- ║      R3) y cuenta (obligatoria si p_paid).                             ║
-- ║   2. UPDATE con guard status='pending': lock atómico — de dos callers  ║
-- ║      en paralelo solo uno matchea; el otro afecta 0 filas y recibe     ║
-- ║      ORDER_NOT_PENDING (R2). Un id ajeno no pasa la RLS → idem (R4).   ║
-- ║      Devuelve business_id/amount/description vía RETURNING...INTO      ║
-- ║      (SELECT...INTO está PROHIBIDO acá: el editor lo confunde con      ║
-- ║      creación de tabla e inyecta un ALTER TABLE adentro del cuerpo).   ║
-- ║   3. Valida que la cuenta sea del MISMO business y no esté archivada   ║
-- ║      (ACCOUNT_INVALID). Si falla, TODO se revierte: el pedido NO       ║
-- ║      queda 'delivered'.                                                ║
-- ║   4. INSERT de la venta: cobrada → settled_at + cuenta; no cobrada →   ║
-- ║      settled_at NULL = flujo Por Cobrar de F1-J. date = fecha de       ║
-- ║      ENTREGA (devengado). status legacy coherente (ADR #26).           ║
-- ║   5. Vincula transaction_id al pedido y devuelve ambos ids.            ║
-- ║                                                                        ║
-- ║  Qué hace get_calendar_month v2:                                       ║
-- ║   Igual que v1 (plata por día del mes, sin _extraordinary, sin plata   ║
-- ║   en días futuros — ADR #20/paridad cards) + orders_count = pedidos    ║
-- ║   PENDING por delivery_date (compromiso, no plata: SÍ vive en días     ║
-- ║   futuros; los entregados ya cuentan como plata vía su venta).         ║
-- ║   Cambiar el RETURNS exige DROP + recrear (R6): el código en           ║
-- ║   producción ya tolera ambas versiones (ordersCount default 0).        ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE (query propia)
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname IN ('deliver_order','get_calendar_month');
--   → espero 1 fila: get_calendar_month (v1). deliver_order aún no existe.
-- SELECT to_regclass('public.orders');   → 'orders' (2A.1 aplicada)


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — deliver_order (correr SOLO este bloque, en una query nueva)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deliver_order(
  p_order_id     UUID,
  p_paid         BOOLEAN,
  p_account_id   UUID DEFAULT NULL,
  p_delivered_on DATE DEFAULT NULL
)
RETURNS TABLE (order_id UUID, transaction_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
  v_business_id UUID;
  v_amount      NUMERIC;
  v_description TEXT;
  v_tx_id       UUID;
BEGIN
  IF p_delivered_on IS NULL THEN
    RAISE EXCEPTION 'DELIVERED_ON_REQUIRED';
  END IF;
  IF p_paid AND p_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED';
  END IF;
  UPDATE public.orders
  SET status = 'delivered'
  WHERE id = p_order_id AND status = 'pending'
  RETURNING business_id, amount, description
  INTO v_business_id, v_amount, v_description;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_PENDING';
  END IF;
  IF p_paid THEN
    PERFORM 1 FROM public.accounts
    WHERE id = p_account_id
      AND business_id = v_business_id
      AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_INVALID';
    END IF;
  END IF;
  INSERT INTO public.transactions
    (business_id, type, amount, date, category, description,
     status, settled_at, to_account_id)
  VALUES
    (v_business_id, 'income', v_amount, p_delivered_on,
     'pedido', v_description,
     CASE WHEN p_paid THEN 'completed' ELSE 'pending' END,
     CASE WHEN p_paid THEN p_delivered_on END,
     CASE WHEN p_paid THEN p_account_id END)
  RETURNING id INTO v_tx_id;
  UPDATE public.orders
  SET transaction_id = v_tx_id
  WHERE id = p_order_id;
  RETURN QUERY SELECT p_order_id, v_tx_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.deliver_order(UUID, BOOLEAN, UUID, DATE) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — get_calendar_month v2 (correr SOLO este bloque, en query nueva)
-- ─────────────────────────────────────────────────────────────────────────

DROP FUNCTION public.get_calendar_month(UUID, DATE);

CREATE FUNCTION public.get_calendar_month(
  p_business_id UUID,
  p_anchor      DATE
)
RETURNS TABLE (date DATE, income NUMERIC, expense NUMERIC, orders_count INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $fn$
  WITH bounds AS (
    SELECT
      date_trunc('month', p_anchor)::date AS m_start,
      (date_trunc('month', p_anchor) + interval '1 month' - interval '1 day')::date AS m_end
  ),
  money AS (
    SELECT
      t.date,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'),  0) AS income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expense
    FROM public.transactions t, bounds b
    WHERE t.business_id = p_business_id
      AND t.date BETWEEN b.m_start AND b.m_end
      AND t.type IN ('income', 'expense')
      AND t.date <= CURRENT_DATE
    GROUP BY t.date
  ),
  ords AS (
    SELECT o.delivery_date AS date, COUNT(*)::int AS orders_count
    FROM public.orders o, bounds b
    WHERE o.business_id = p_business_id
      AND o.status = 'pending'
      AND o.delivery_date BETWEEN b.m_start AND b.m_end
    GROUP BY o.delivery_date
  )
  SELECT
    COALESCE(m.date, o.date) AS date,
    COALESCE(m.income, 0)    AS income,
    COALESCE(m.expense, 0)   AS expense,
    COALESCE(o.orders_count, 0) AS orders_count
  FROM money m
  FULL OUTER JOIN ords o ON o.date = m.date;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_calendar_month(UUID, DATE) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST (correr después de aplicar — LESSONS #6)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) Ambas funciones presentes (espero 2 filas):
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('deliver_order', 'get_calendar_month');
--
-- 2) Control de paridad plata (igual a Etapa 1 — deben coincidir):
--   WITH b AS (SELECT id FROM public.businesses ORDER BY created_at LIMIT 1)
--   SELECT
--     (SELECT COALESCE(SUM(income),0) FROM public.get_calendar_month((SELECT id FROM b), CURRENT_DATE)) AS rpc_income,
--     (SELECT COALESCE(SUM(amount),0) FROM public.transactions
--        WHERE business_id = (SELECT id FROM b) AND type = 'income'
--          AND date BETWEEN date_trunc('month', CURRENT_DATE)::date AND CURRENT_DATE) AS direct_income;
--
-- 3) Test funcional COMPLETO del ciclo (correr CADA sub-paso por separado;
--    al final queda todo limpio). Crea pedido → marca en calendario →
--    entrega SIN cobro → venta Por Cobrar → doble entrega rechazada →
--    borrar venta deshace entrega (trigger R7) → limpieza.
--
--   -- 3a. Pedido de prueba con entrega en 3 días
--   INSERT INTO public.orders (business_id, client_name, description, amount, delivery_date)
--   SELECT id, 'TEST e2e', 'ciclo completo', 500, CURRENT_DATE + 3
--   FROM public.businesses ORDER BY created_at LIMIT 1;
--
--   -- 3b. El calendario debe mostrar orders_count=1 en ese día (espero 1 fila):
--   SELECT * FROM public.get_calendar_month(
--     (SELECT id FROM public.businesses ORDER BY created_at LIMIT 1), CURRENT_DATE
--   ) WHERE orders_count > 0;
--
--   -- 3c. Entregar SIN cobro (espero: 1 fila con order_id + transaction_id):
--   SELECT * FROM public.deliver_order(
--     (SELECT id FROM public.orders WHERE client_name = 'TEST e2e'),
--     false, NULL, CURRENT_DATE
--   );
--
--   -- 3d. La venta quedó Por Cobrar (espero: type income, settled_at NULL):
--   SELECT type, amount, settled_at FROM public.transactions WHERE description = 'ciclo completo';
--
--   -- 3e. Doble entrega debe FALLAR (espero: ERROR ORDER_NOT_PENDING — si da error, está BIEN):
--   SELECT * FROM public.deliver_order(
--     (SELECT id FROM public.orders WHERE client_name = 'TEST e2e'),
--     false, NULL, CURRENT_DATE
--   );
--
--   -- 3f. Borrar la venta deshace la entrega (trigger R7; espero: pending, t):
--   DELETE FROM public.transactions WHERE description = 'ciclo completo';
--   SELECT status, transaction_id IS NULL AS sin_link
--   FROM public.orders WHERE client_name = 'TEST e2e';
--
--   -- 3g. Limpieza
--   DELETE FROM public.orders WHERE client_name = 'TEST e2e';
