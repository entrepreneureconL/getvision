-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-M.2 — Eje de desglose para los bloques Ingresos / Costos del mes   ║
-- ║  Junio 2026                                                            ║
-- ║                                                                        ║
-- ║  Qué hace:                                                             ║
-- ║   Agrega dos columnas a `businesses`:                                  ║
-- ║     • income_breakdown_axis   ('channel' | 'category')  default 'channel' ║
-- ║     • expense_breakdown_axis  ('channel' | 'category')  default 'channel' ║
-- ║                                                                        ║
-- ║   Una por bloque, independientes, porque el uso real puede divergir:   ║
-- ║   peluquera quiere ingresos por etiqueta ("Corte" vs "Color") pero     ║
-- ║   costos por canal ("salió de MP vs Efectivo").                        ║
-- ║                                                                        ║
-- ║  Reversibilidad: aditiva. Sin migration de datos. Sin afectar          ║
-- ║  transactions ni category_overrides.                                   ║
-- ║                                                                        ║
-- ║  Idempotencia: corré 2+ veces sin romper.                              ║
-- ║                                                                        ║
-- ║  Negocios viejos sin migration corrida → el código lee defaults vía    ║
-- ║  `getIncomeBreakdownAxis()` / `getExpenseBreakdownAxis()` que devuelven║
-- ║  'channel' cuando el campo es null. No rompe nada hasta que se aplique. ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS income_breakdown_axis VARCHAR(20)
    NOT NULL DEFAULT 'channel'
    CHECK (income_breakdown_axis IN ('channel','category'));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS expense_breakdown_axis VARCHAR(20)
    NOT NULL DEFAULT 'channel'
    CHECK (expense_breakdown_axis IN ('channel','category'));

-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST
-- ─────────────────────────────────────────────────────────────────────────
-- Columnas y defaults:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'businesses'
--     AND column_name LIKE '%breakdown_axis';
--
-- Constraint check funciona:
--   UPDATE businesses SET income_breakdown_axis = 'invalid' WHERE id = ...;
--   -- debe fallar con: new row violates check constraint
