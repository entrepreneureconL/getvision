-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  P-009 / D-18 — Bucket de Storage `logos` (avatar/logo del negocio)    ║
-- ║  Junio 2026 · P-009 (parte IT) · ADR #7 (bucket público)              ║
-- ║                                                                        ║
-- ║  Por qué existe:                                                       ║
-- ║   La UI del avatar ya está en prod (SettingScreen.handlePickAvatar):  ║
-- ║   sube a `logos` y guarda la URL pública en businesses.logo_url. Sin  ║
-- ║   el bucket el upload falla y la pantalla degrada con un aviso amable. ║
-- ║   Esta migration es el ÚNICO eslabón faltante para que la foto persista║
-- ║                                                                        ║
-- ║  Contrato del cliente (no cambiar sin tocar el código):                ║
-- ║   - Path de subida: `<business_id>/avatar_<ts>.<ext>` → el 1er        ║
-- ║     segmento de la carpeta ES el business_id (base de la RLS).         ║
-- ║   - upsert:true → además de INSERT hace falta política de UPDATE.      ║
-- ║   - getPublicUrl → el bucket DEBE ser público (ADR #7: logos no son    ║
-- ║     sensibles; evita el overhead de signed URLs).                      ║
-- ║                                                                        ║
-- ║  Diseño de seguridad:                                                  ║
-- ║   - Lectura: pública vía CDN del bucket (no requiere policy SELECT).   ║
-- ║   - Escritura: solo el dueño, y SOLO en la carpeta de un business suyo ║
-- ║     (la RLS compara (storage.foldername(name))[1] contra sus business).║
-- ║   - Límites de higiene: 5 MB y solo imágenes (app financiera).         ║
-- ║                                                                        ║
-- ║  Sin cuerpos $…$ → el SQL Editor de Supabase lo corre entero (no       ║
-- ║  aplica LESSONS #10). Alternativa al PASO 1: crear el bucket por el     ║
-- ║  Dashboard (Storage → New bucket `logos`, Public ON) y correr solo las  ║
-- ║  políticas del PASO 2.                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0 — Verificación PRE
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT id FROM storage.buckets WHERE id = 'logos';   -- debe devolver 0 filas


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 — Bucket público + límites de higiene
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 — Políticas owner sobre storage.objects
-- ─────────────────────────────────────────────────────────────────────────
-- El dueño solo escribe en la carpeta cuyo nombre == el id de un business suyo.
-- (storage.foldername(name))[1] = primer segmento de la ruta = business_id.

CREATE POLICY "logos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Requerida por upsert:true del cliente (al re-subir, Storage hace UPDATE).
CREATE POLICY "logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Opcional: habilita limpieza futura de avatares viejos (el cliente hoy no
-- borra — los nombres llevan timestamp). Sin riesgo: mismo guard de dueño.
CREATE POLICY "logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación POST (correr después de aplicar — LESSONS #6)
-- ─────────────────────────────────────────────────────────────────────────
-- 1) El bucket existe y es público (debe devolver una fila con public = t):
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'logos';
--
-- 2) Las 3 políticas presentes (debe devolver logos_owner_insert/update/delete):
--   SELECT policyname FROM pg_policies
--   WHERE tablename = 'objects' AND policyname LIKE 'logos_%';
--
-- 3) Probe RLS sin sesión (cliente ANON sin login, NO el SQL Editor que es
--    service_role): un upload a 'logos' debe fallar con 42501.
--
-- 4) Funcional e2e (CEO, logueado):
--    a. Perfil → "Subir foto" → elegir imagen → recargar la app → la foto
--       persiste (ya no degrada al aviso "No se pudo guardar la foto").
--    b. Aislamiento: un upload a '<otroBusinessId>/x.jpg' debe ser rechazado
--       (la carpeta no matchea ningún business del usuario).
