// @ts-nocheck — Deno Edge Function (no la chequea el tsc de la app RN).
//
// P-009 — Subida del avatar del negocio EVITANDO la RLS de Storage.
//
// Por qué existe: este proyecto migró a "JWT Signing Keys" (los tokens llevan
// `kid`). El servicio de Storage de este proyecto NO valida esos tokens —
// trata el upload como `anon` y lo rechaza con "violates row-level security
// policy" — aunque PostgREST/Auth SÍ los validan (verificado en P-009: misma
// auth daba REST 200 y Storage 403). En vez de pelear con Storage, el cliente
// manda la imagen acá; esta función:
//   1) identifica al usuario con auth.getUser(jwt) — GoTrue valida sus propios
//      tokens keyed sin problema;
//   2) confirma que el negocio es del usuario (ownership);
//   3) sube a Storage con service_role, que SALTEA la RLS por completo;
//   4) guarda businesses.logo_url y devuelve la URL pública.
//
// DEPLOY (Dashboard, sin CLI): Edge Functions → Deploy a new function →
// nombre EXACTO `avatar-upload` → pegar este código → **DESACTIVAR "Verify JWT"**
// (la verificación la hacemos a mano adentro con getUser). SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY ya vienen inyectadas como secrets por defecto.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-business-id, x-file-ext',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'missing token' }, 401);

    const businessId = req.headers.get('x-business-id') ?? '';
    const ext = (req.headers.get('x-file-ext') ?? 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
    const contentType = req.headers.get('Content-Type') ?? 'image/jpeg';
    if (!businessId) return json({ error: 'missing business id' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Identidad — GoTrue valida el token keyed.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'invalid token' }, 401);

    // 2) Ownership — el negocio tiene que ser del usuario.
    const { data: biz } = await admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!biz) return json({ error: 'not owner of business' }, 403);

    // 3) Subida con service_role (saltea RLS de Storage).
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) return json({ error: 'empty file' }, 400);
    const path = `${businessId}/avatar_${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from('logos')
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);

    // 4) URL pública + persistir en businesses.logo_url.
    const { data: pub } = admin.storage.from('logos').getPublicUrl(path);
    await admin.from('businesses').update({ logo_url: pub.publicUrl }).eq('id', businessId);

    return json({ publicUrl: pub.publicUrl }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
