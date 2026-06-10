-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-M fix — Deduplicar accounts + agregar UNIQUE constraint            ║
-- ║  Junio 2026                                                            ║
-- ║                                                                        ║
-- ║  Bug detectado en testing manual:                                      ║
-- ║   ensureDefaultsForBusiness (la "red de seguridad" que seedea las 3    ║
-- ║   cuentas default por business) chequeaba length==0 ANTES de insertar  ║
-- ║   pero la tabla NO tenía UNIQUE(business_id, name, kind). Si el helper ║
-- ║   se llamaba en paralelo (App.tsx + DashboardScreen.useEffect en el    ║
-- ║   mismo tick) ambas calls pasaban el check y se duplicaban las cuentas.║
-- ║                                                                        ║
-- ║  Síntoma: el usuario veía 2 chips "Efectivo" / 2 "Mercado Pago" /      ║
-- ║   2 "Banco" y las sumas no cuadraban según cuál eligiera.              ║
-- ║                                                                        ║
-- ║  Qué hace este script:                                                 ║
-- ║   1) Para cada (business_id, name, kind) duplicado, conserva el más    ║
-- ║      antiguo (created_at MIN) y reasigna todas las transactions que    ║
-- ║      apuntaban al duplicado hacia el conservado.                       ║
-- ║   2) Borra los duplicados.                                             ║
-- ║   3) Agrega UNIQUE(business_id, name, kind) para prevenir futuro.      ║
-- ║                                                                        ║
-- ║  Idempotencia: si NO hay duplicados, el script no toca nada. Si la     ║
-- ║   constraint ya existe, falla en el ADD (esperado — corré una vez).    ║
-- ║                                                                        ║
-- ║  Reversibilidad: el DELETE es destructivo. Si querés un dry-run, corré ║
-- ║   primero solo el SELECT de la sección "1.0 inspect" para ver qué se   ║
-- ║   iba a tocar.                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- 1.0 — Inspect (dry-run): ver qué duplicados hay
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT business_id, name, kind, COUNT(*) AS copias,
--        MIN(created_at) AS keep_created_at, MAX(created_at) AS drop_created_at
-- FROM public.accounts
-- GROUP BY business_id, name, kind
-- HAVING COUNT(*) > 1
-- ORDER BY business_id, name;

-- ─────────────────────────────────────────────────────────────────────────
-- 1.1 — Dedup en una transacción
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

-- CTE: para cada (business_id, name, kind) que tenga duplicados, identifica
-- al "ganador" (created_at más viejo) y los "perdedores" (a borrar).
WITH ranked AS (
  SELECT
    id,
    business_id,
    name,
    kind,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, name, kind
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.accounts
),
winners AS (
  SELECT business_id, name, kind, id AS keep_id
  FROM ranked
  WHERE rn = 1
),
losers AS (
  SELECT r.id AS drop_id, w.keep_id, r.business_id
  FROM ranked r
  JOIN winners w
    ON w.business_id = r.business_id
   AND w.name = r.name
   AND w.kind = r.kind
  WHERE r.rn > 1
)

-- Reasigna transactions que apuntan a las perdedoras → ganadoras (to_account).
UPDATE public.transactions t
SET to_account_id = l.keep_id
FROM losers l
WHERE t.to_account_id = l.drop_id;

-- Lo mismo para from_account.
WITH ranked AS (
  SELECT
    id, business_id, name, kind, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, name, kind
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.accounts
),
winners AS (
  SELECT business_id, name, kind, id AS keep_id FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS drop_id, w.keep_id
  FROM ranked r
  JOIN winners w
    ON w.business_id = r.business_id
   AND w.name = r.name
   AND w.kind = r.kind
  WHERE r.rn > 1
)
UPDATE public.transactions t
SET from_account_id = l.keep_id
FROM losers l
WHERE t.from_account_id = l.drop_id;

-- Ahora sí, borrar las duplicadas.
WITH ranked AS (
  SELECT
    id, business_id, name, kind, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, name, kind
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.accounts
)
DELETE FROM public.accounts a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- 1.2 — Agregar UNIQUE constraint para prevenir duplicados a futuro
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_business_name_kind_unique
  UNIQUE (business_id, name, kind);

-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST
-- ─────────────────────────────────────────────────────────────────────────
-- Debe devolver 0 filas:
--   SELECT business_id, name, kind, COUNT(*)
--   FROM public.accounts
--   GROUP BY business_id, name, kind
--   HAVING COUNT(*) > 1;
--
-- Debe devolver 1 fila con conname = accounts_business_name_kind_unique:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.accounts'::regclass AND contype = 'u';
