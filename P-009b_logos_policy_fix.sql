-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  P-009b — Fix de la policy de `logos`: ownership vía SECURITY DEFINER  ║
-- ║  Junio 2026 · P-009 · corrige el bug de la subquery anidada            ║
-- ║                                                                        ║
-- ║  Síntoma: el upload del avatar fallaba con 403 "new row violates       ║
-- ║  row-level security policy" AUNQUE el usuario estaba autenticado       ║
-- ║  (lecturas y escrituras a la DB funcionaban: "Cambios guardados" OK).  ║
-- ║                                                                        ║
-- ║  Causa raíz: la policy original chequeaba la propiedad con una         ║
-- ║  subquery a `public.businesses`, que tiene su propia RLS. Dentro de    ║
-- ║  la evaluación de una policy de storage.objects, esa subquery anidada  ║
-- ║  vuelve VACÍA aunque auth.uid() sea correcto (gotcha conocido de       ║
-- ║  Supabase). En el SQL Editor la subquery sí veía la fila — por eso     ║
-- ║  `insert_check_passes` daba true y no coincidía con la realidad.       ║
-- ║                                                                        ║
-- ║  Fix: mover el chequeo de propiedad a una función SECURITY DEFINER     ║
-- ║  (corre como su dueño → saltea la RLS de `businesses` y ve la fila de  ║
-- ║  forma confiable). auth.uid() sigue resolviendo al usuario del request.║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Función de propiedad (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────
-- Recibe el `name` del objeto (ej. '<business_id>/avatar_123.jpg') y devuelve
-- true si el primer segmento (la carpeta = business_id) pertenece al usuario
-- actual. SECURITY DEFINER + search_path fijo = lectura confiable sin la RLS
-- anidada; STABLE porque no escribe.
CREATE OR REPLACE FUNCTION public.owns_logo_folder(object_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id::text = split_part(object_name, '/', 1)
      AND user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Limpiar policies viejas (las 3 nuestras + la de prueba abierta +
--          la manual que quedó del intento anterior)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "logos_owner_insert"          ON storage.objects;
DROP POLICY IF EXISTS "logos_owner_update"          ON storage.objects;
DROP POLICY IF EXISTS "logos_owner_delete"          ON storage.objects;
DROP POLICY IF EXISTS "logos_test_any_authenticated" ON storage.objects;  -- prueba abierta — IMPORTANTE removerla
DROP POLICY IF EXISTS "users_upload_own_logo"        ON storage.objects;   -- leftover del intento manual

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 — Recrear las policies usando la función (sin subquery anidada)
-- ─────────────────────────────────────────────────────────────────────────
CREATE POLICY "logos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.owns_logo_folder(name));

CREATE POLICY "logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'logos' AND public.owns_logo_folder(name))
  WITH CHECK (bucket_id = 'logos' AND public.owns_logo_folder(name));

CREATE POLICY "logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.owns_logo_folder(name));

-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST
-- ─────────────────────────────────────────────────────────────────────────
-- 1) Función creada (debe devolver 1 fila):
--   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'owns_logo_folder';
--   (prosecdef = t confirma SECURITY DEFINER)
--
-- 2) Solo nuestras 3 policies, sin la de prueba ni la manual:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
--   (esperado: logos_owner_insert / _update / _delete — NADA de _test_ ni users_upload_own_logo)
--
-- 3) Funcional: subir la foto desde Perfil → guarda y persiste tras recargar.
