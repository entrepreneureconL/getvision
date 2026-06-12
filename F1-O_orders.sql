-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-O Etapa 2 / D-21 — Tabla `orders` (pedidos de clientes)            ║
-- ║  Junio 2026 · P-011 · ADR #30 · spec DESIGN §4.7.bis                   ║
-- ║                                                                        ║
-- ║  Por qué existe:                                                       ║
-- ║   Un pedido NO es una transaction — la plata todavía no se movió       ║
-- ║   (ADR #20). Vive en tabla propia y se CONVIERTE en transaction al     ║
-- ║   entregar (RPC `deliver_order`, migration siguiente). Así los KPIs    ║
-- ║   del período no se contaminan con compromisos futuros.                ║
-- ║                                                                        ║
-- ║  Diseño:                                                               ║
-- ║   - RLS owner estándar DESDE EL PRIMER INSERT (regla no-negociable #3).║
-- ║   - Borrar la venta vinculada = DESHACER la entrega: un trigger        ║
-- ║     (PASO 4) devuelve el pedido a 'pending' y limpia transaction_id.   ║
-- ║     Sin estados huérfanos ('delivered' sin plata no existe) y el       ║
-- ║     pedido vuelve a la agenda, re-entregable. El FK queda SET NULL     ║
-- ║     como red de seguridad si el trigger faltara; RESTRICT daría un     ║
-- ║     error inexplicable al borrar desde Movimientos.                    ║
-- ║   - `external_event_id` reservado para Google Calendar (P-012,         ║
-- ║     parqueado) → cero re-migración cuando entre.                       ║
-- ║   - Índice parcial sobre 'pending': calendario y agenda solo miran     ║
-- ║     pedidos vivos; el histórico de entregados no engorda el índice.    ║
-- ║                                                                        ║
-- ║  Esta migration NO toca `get_calendar_month` (eso es la siguiente:     ║
-- ║  F1-O_deliver_order.sql, que requiere DROP+recreate por cambio de      ║
-- ║  firma). Separadas a propósito: cada una verifica lo suyo.             ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT to_regclass('public.orders');   -- debe ser NULL (la tabla no existe)


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Tabla
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_name       VARCHAR(100) NOT NULL,
  client_id         UUID NULL,                -- F2: FK a `clients` cuando exista
  description       VARCHAR(120) NOT NULL,
  amount            DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  delivery_date     DATE NOT NULL,            -- siempre via toLocalISODate (LESSONS #2)
  delivery_time     TIME NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','delivered','cancelled')),
  transaction_id    UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  external_event_id TEXT NULL,                -- reservado P-012 (Google Calendar)
  notes             VARCHAR(200) NULL,
  created_at        TIMESTAMP DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — RLS (antes del primer insert, regla #3)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_owner ON public.orders
  FOR ALL
  USING      (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — Índices (patrón de acceso: SIEMPRE negocio + fecha de entrega)
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX orders_business_delivery_idx
  ON public.orders (business_id, delivery_date);

-- Parcial: solo pedidos vivos. El calendario (orders_count) y la agenda del
-- día filtran status='pending' — este índice no crece con el histórico.
CREATE INDEX orders_pending_idx
  ON public.orders (business_id, delivery_date)
  WHERE status = 'pending';


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 4 — Trigger "borrar la venta deshace la entrega"
-- ─────────────────────────────────────────────────────────────────────────
-- Sin esto, borrar la transaction vinculada dejaría el pedido 'delivered'
-- sin plata registrada y SIN camino de recuperación ('delivered' es
-- terminal) — la venta del pedido se perdería salvo recarga manual.
-- Con el trigger, la semántica es honesta: borrar la venta = "esa entrega
-- no valió" → el pedido vuelve a 'pending', reaparece en la agenda y se
-- puede volver a entregar. La garantía vive en DB (mismo principio que
-- deliver_order): funciona igual si el delete vino de Movimientos, del
-- SQL Editor o de un código futuro que se olvide del vínculo.
--
-- BEFORE DELETE a propósito: corre antes de que el FK SET NULL limpie
-- transaction_id, así el WHERE todavía encuentra el pedido.
-- Sin SECURITY DEFINER: el UPDATE corre como el usuario y la RLS de
-- `orders` aplica (el dueño de la venta es el dueño del pedido).

CREATE OR REPLACE FUNCTION public.revert_order_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'pending', transaction_id = NULL
  WHERE transaction_id = OLD.id
    AND status = 'delivered';
  RETURN OLD;
END;
$$;

CREATE TRIGGER orders_revert_on_tx_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_order_on_transaction_delete();


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST (correr después de aplicar — LESSONS #6)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) La tabla existe (debe devolver 'orders', NO null):
--   SELECT to_regclass('public.orders');
--
-- 2) RLS activo (debe ser t):
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'orders';
--
-- 3) Policy presente (debe devolver 1 fila 'orders_owner'):
--   SELECT policyname FROM pg_policies WHERE tablename = 'orders';
--
-- 4) Índices (deben aparecer 3: orders_pkey + orders_business_delivery_idx
--    + orders_pending_idx):
--   SELECT indexname FROM pg_indexes WHERE tablename = 'orders';
--
-- 5) Constraint de estados (debe fallar con check violation):
--   INSERT INTO public.orders (business_id, client_name, description, amount, delivery_date, status)
--   VALUES ((SELECT id FROM public.businesses LIMIT 1), 'probe', 'probe', 1, CURRENT_DATE, 'bogus');
--
-- 6) Trigger de reversión presente (debe devolver 1 fila):
--   SELECT tgname FROM pg_trigger WHERE tgname = 'orders_revert_on_tx_delete';
--
-- 7) Probe RLS sin sesión (correr desde un cliente ANON sin login, NO desde
--    el SQL Editor que es service_role): el INSERT debe fallar con 42501.
--    Desde el SQL Editor alcanza con confirmar 2) y 3).
--
-- 8) (Funcional, se completa en el e2e de 2A.2 cuando exista deliver_order:
--    entregar un pedido → borrar la venta desde Movimientos → el pedido
--    debe volver a 'pending' con transaction_id NULL y reaparecer en la
--    agenda del calendario.)
