-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-O Etapa 2A.2 — RPC `deliver_order` + `get_calendar_month` v2       ║
-- ║  Junio 2026 · P-011 · plan F1-O_ETAPA2_PLAN.md (riesgos R1-R6)         ║
-- ║                                                                        ║
-- ║  Por qué existe:                                                       ║
-- ║   "Entregar" son DOS escrituras (crear la venta + marcar el pedido).   ║
-- ║   Hechas desde el cliente, una caída de red entre ambas deja plata     ║
-- ║   invisible o duplicada (R1). Acá es UNA transacción Postgres: todo    ║
-- ║   o nada.                                                              ║
-- ║                                                                        ║
-- ║  Diseño:                                                               ║
-- ║   - SECURITY INVOKER: RLS del usuario aplica a orders Y transactions.  ║
-- ║   - SELECT ... FOR UPDATE + guard status='pending': doble tap o dos    ║
-- ║     devices en paralelo → exactamente UNA venta; el segundo recibe     ║
-- ║     ORDER_NOT_PENDING (R2, LESSONS #5: la garantía vive en DB).        ║
-- ║   - p_delivered_on viene del CLIENTE (todayLocalISO). CURRENT_DATE     ║
-- ║     acá es UTC: a las 21:00+ de Buenos Aires ya es "mañana" (R3,       ║
-- ║     cara server-side de LESSONS #2).                                   ║
-- ║   - RAISE EXCEPTION con códigos propios: un id ajeno (RLS) o un        ║
-- ║     estado inválido NUNCA devuelven éxito silencioso (R4, LESSONS #3). ║
-- ║   - La venta resultante es indistinguible de una venta normal:         ║
-- ║     cobrada → settled_at + cuenta; no cobrada → settled_at NULL =      ║
-- ║     cae al flujo Por Cobrar de F1-J. Cero cambios en KPIs/MiPlata.     ║
-- ║                                                                        ║
-- ║  get_calendar_month v2: cambiar el RETURNS exige DROP + recrear (R6 —  ║
-- ║  OR REPLACE no puede cambiar la firma). El código en producción ya     ║
-- ║  tolera ambas versiones (ordersCount default 0) y degrada a calendario ║
-- ║  sin puntos si la RPC falla durante la ventana de aplicación.          ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'deliver_order';        -- 0 filas
-- SELECT to_regclass('public.orders');                                -- 'orders' (2A.1 aplicada)


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — RPC atómica deliver_order
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deliver_order(
  p_order_id     UUID,
  p_paid         BOOLEAN,
  p_account_id   UUID DEFAULT NULL,   -- obligatorio si p_paid: la plata entró a ALGUNA cuenta
  p_delivered_on DATE DEFAULT NULL    -- todayLocalISO() del cliente — NUNCA CURRENT_DATE (R3)
)
RETURNS TABLE (order_id UUID, transaction_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF p_delivered_on IS NULL THEN
    RAISE EXCEPTION 'DELIVERED_ON_REQUIRED';
  END IF;
  IF p_paid AND p_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED';
  END IF;

  -- Lock + guard atómico (R2). Un id ajeno no pasa la RLS → NOT FOUND (R4).
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_PENDING';
  END IF;

  -- Defensa de integridad: la cuenta debe ser del MISMO business del pedido
  -- (un uuid de cuenta ajena o archivada no debe colarse en la venta).
  IF p_paid THEN
    PERFORM 1 FROM public.accounts
    WHERE id = p_account_id
      AND business_id = v_order.business_id
      AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_INVALID';
    END IF;
  END IF;

  -- La conversión: aterriza en el modelo F1-J existente sin inventar nada.
  -- date = fecha de ENTREGA (el hecho económico es la entrega — devengado).
  -- status legacy se setea coherente para los caminos viejos de isPending (ADR #26).
  INSERT INTO public.transactions
    (business_id, type, amount, date, category, description,
     status, settled_at, to_account_id)
  VALUES
    (v_order.business_id, 'income', v_order.amount, p_delivered_on,
     'pedido', v_order.description,
     CASE WHEN p_paid THEN 'completed' ELSE 'pending' END,
     CASE WHEN p_paid THEN p_delivered_on END,
     CASE WHEN p_paid THEN p_account_id END)
  RETURNING id INTO v_tx_id;

  UPDATE public.orders
  SET status = 'delivered', transaction_id = v_tx_id
  WHERE id = p_order_id;

  RETURN QUERY SELECT p_order_id, v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_order(UUID, BOOLEAN, UUID, DATE) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — get_calendar_month v2 (+ orders_count por día)
-- ─────────────────────────────────────────────────────────────────────────
-- R6: cambiar el tipo de retorno exige DROP — CREATE OR REPLACE fallaría.
DROP FUNCTION public.get_calendar_month(UUID, DATE);

CREATE FUNCTION public.get_calendar_month(
  p_business_id UUID,
  p_anchor      DATE
)
RETURNS TABLE (date DATE, income NUMERIC, expense NUMERIC, orders_count INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
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
      AND t.type IN ('income', 'expense')   -- paridad con las cards (ADR #20)
      AND t.date <= CURRENT_DATE            -- plata: JAMÁS en el futuro
    GROUP BY t.date
  ),
  ords AS (
    -- Pedidos pendientes: compromiso de entrega, NO plata — por eso SÍ
    -- viven en días futuros (la distinción visual la hace el widget).
    -- Los entregados no cuentan acá: ya son puntos de plata vía su venta.
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
$$;

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
-- 3) Test funcional COMPLETO del ciclo (correr entero; al final queda todo
--    limpio). Crea pedido → entrega SIN cobro → valida venta Por Cobrar +
--    orders_count → borra la venta → el trigger R7 revierte → limpieza.
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
--   -- 3e. Doble entrega debe FALLAR (espero: ERROR ORDER_NOT_PENDING):
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
