-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  F1-L — Categorías custom + archive de defaults                        ║
-- ║  Junio 2026                                                            ║
-- ║                                                                        ║
-- ║  Qué hace:                                                             ║
-- ║   1) Crea tabla `category_overrides` con RLS.                          ║
-- ║   2) Una fila representa: (a) categoría custom nueva del business      ║
-- ║      (is_archived=false, value distinto a defaults), o (b) archive de  ║
-- ║      una categoría default (is_archived=true, value matchea default).  ║
-- ║                                                                        ║
-- ║  Reversibilidad: aditiva. Sin migration de datos. Sin transactions     ║
-- ║  modificadas — el `transactions.category` sigue siendo string libre    ║
-- ║  (ADR #15).                                                            ║
-- ║                                                                        ║
-- ║  Idempotencia: corré 2+ veces sin romper.                              ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.category_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  value           VARCHAR(60) NOT NULL,    -- snake_case slug (mismo patrón que defaults)
  label           VARCHAR(80) NOT NULL,    -- "Tinte capilar"
  icon            VARCHAR(10) NOT NULL,    -- emoji "🎨"
  tint            VARCHAR(20) NOT NULL CHECK (tint IN ('success','warning','danger','info','accent')),
  type            VARCHAR(20) NOT NULL CHECK (type IN ('income','expense')),
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  -- is_archived=true sobre value que coincide con default → oculta ese default del picker.
  -- is_archived=false sobre value libre → suma como custom al picker.
  suggested_from_rubro VARCHAR(80) NULL,   -- tracking: si vino de SUGGESTED_CATEGORIES_BY_RUBRO
  created_at      TIMESTAMP NOT NULL DEFAULT now(),

  -- Un business no puede tener 2 overrides con el mismo value (evita duplicados
  -- al archivar/custom). Si se crea un value que coincide con default, se asume
  -- archive (a menos que is_archived=false → entonces es override de visualización
  -- del default, futuro caso).
  UNIQUE(business_id, value)
);

ALTER TABLE public.category_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_overrides_owner ON public.category_overrides;
CREATE POLICY category_overrides_owner ON public.category_overrides
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS category_overrides_business_idx
  ON public.category_overrides(business_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST
-- ─────────────────────────────────────────────────────────────────────────
-- Tabla creada:
--   SELECT to_regclass('public.category_overrides');
-- RLS activo:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'category_overrides';
