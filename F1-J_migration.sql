-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-J — Refundación stock-flow (migration Supabase)                    ║
-- ║  Junio 2026                                                            ║
-- ║                                                                        ║
-- ║  Qué hace:                                                             ║
-- ║   1) Crea tabla `accounts` con RLS + seed silencioso para businesses   ║
-- ║      ya existentes (3 cuentas por defecto: Efectivo, Mercado Pago,     ║
-- ║      Banco).                                                           ║
-- ║   2) Extiende `transactions` con 3 columnas nullable:                  ║
-- ║        settled_at      DATE  — NULL = pendiente (receivable/payable)   ║
-- ║        from_account_id UUID  — cuenta que sale (en expenses)           ║
-- ║        to_account_id   UUID  — cuenta que entra (en incomes)           ║
-- ║   3) Backfilea filas existentes (las que tenían status='completed'     ║
-- ║      se marcan saldadas en la cuenta default).                         ║
-- ║                                                                        ║
-- ║  Reversibilidad: aditiva. NO drop de columnas. El `status` legacy      ║
-- ║  queda en la tabla por compatibilidad.                                 ║
-- ║                                                                        ║
-- ║  Idempotencia: se puede correr 2+ veces sin romper (usa IF NOT EXISTS  ║
-- ║  y WHERE NOT EXISTS en seeds).                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0  — Verificación PRE (corré esto antes de aplicar, copiá outputs)
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) AS businesses_count FROM public.businesses;
-- SELECT type, COUNT(*) FROM public.transactions GROUP BY type ORDER BY type;
-- SELECT to_regclass('public.accounts') AS accounts_table_exists;  -- debería ser NULL


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Tabla `accounts`
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name            VARCHAR(60) NOT NULL,
  kind            VARCHAR(20) NOT NULL CHECK (kind IN ('cash','bank','mp','wallet','other')),
  is_default      BOOLEAN NOT NULL DEFAULT false,
  initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  archived_at     TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Policy idempotente
DROP POLICY IF EXISTS accounts_owner ON public.accounts;
CREATE POLICY accounts_owner ON public.accounts
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS accounts_business_idx
  ON public.accounts(business_id)
  WHERE archived_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Seed silencioso (solo para businesses sin cuentas)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.accounts (business_id, name, kind, is_default, initial_balance)
SELECT b.id, 'Efectivo', 'cash', true, 0
  FROM public.businesses b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.accounts a WHERE a.business_id = b.id AND a.kind = 'cash'
 );

INSERT INTO public.accounts (business_id, name, kind, is_default, initial_balance)
SELECT b.id, 'Mercado Pago', 'mp', false, 0
  FROM public.businesses b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.accounts a WHERE a.business_id = b.id AND a.kind = 'mp'
 );

INSERT INTO public.accounts (business_id, name, kind, is_default, initial_balance)
SELECT b.id, 'Banco', 'bank', false, 0
  FROM public.businesses b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.accounts a WHERE a.business_id = b.id AND a.kind = 'bank'
 );


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — Extender `transactions`
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS settled_at      DATE NULL,
  ADD COLUMN IF NOT EXISTS from_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_account_id   UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_pending_idx
  ON public.transactions(business_id, settled_at)
  WHERE settled_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 4 — Backfill: transacciones históricas
--   Regla: las que ya estaban marcadas como 'completed' (default histórico)
--   se asumen saldadas en `date` y van a la cuenta default del business.
--   Las 'pending' del status legacy quedan con settled_at NULL → coinciden
--   con la nueva semántica.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.transactions
   SET settled_at = date
 WHERE settled_at IS NULL
   AND COALESCE(status, 'completed') = 'completed';

-- Ingresos saldados sin cuenta destino → asignar a la cuenta default
UPDATE public.transactions t
   SET to_account_id = (
     SELECT id FROM public.accounts
      WHERE business_id = t.business_id AND is_default = true AND archived_at IS NULL
      LIMIT 1
   )
 WHERE t.type IN ('income','income_extraordinary')
   AND t.settled_at IS NOT NULL
   AND t.to_account_id IS NULL;

-- Egresos saldados sin cuenta origen → asignar a la cuenta default
UPDATE public.transactions t
   SET from_account_id = (
     SELECT id FROM public.accounts
      WHERE business_id = t.business_id AND is_default = true AND archived_at IS NULL
      LIMIT 1
   )
 WHERE t.type IN ('expense','expense_extraordinary')
   AND t.settled_at IS NOT NULL
   AND t.from_account_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 5  — Verificación POST (corré esto después de aplicar)
-- ─────────────────────────────────────────────────────────────────────────
-- Cada business debe tener 3 cuentas (cash, mp, bank):
--   SELECT b.id, b.name, COUNT(a.id) AS accounts_count
--     FROM public.businesses b
--     LEFT JOIN public.accounts a ON a.business_id = b.id
--    GROUP BY b.id, b.name
--    ORDER BY b.name;
--
-- Repartición saldado vs pendiente:
--   SELECT
--     COUNT(*) FILTER (WHERE settled_at IS NOT NULL) AS settled,
--     COUNT(*) FILTER (WHERE settled_at IS NULL)     AS pending
--     FROM public.transactions;
--
-- Ingresos saldados deben tener to_account_id:
--   SELECT type,
--          COUNT(*) FILTER (WHERE to_account_id IS NOT NULL) AS with_to,
--          COUNT(*) FILTER (WHERE to_account_id IS NULL)     AS without_to
--     FROM public.transactions
--    WHERE type IN ('income','income_extraordinary') AND settled_at IS NOT NULL
--    GROUP BY type;
--
-- Egresos saldados deben tener from_account_id:
--   SELECT type,
--          COUNT(*) FILTER (WHERE from_account_id IS NOT NULL) AS with_from,
--          COUNT(*) FILTER (WHERE from_account_id IS NULL)     AS without_from
--     FROM public.transactions
--    WHERE type IN ('expense','expense_extraordinary') AND settled_at IS NOT NULL
--    GROUP BY type;
