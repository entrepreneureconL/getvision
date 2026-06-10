import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// F0-5 hardening: si las vars no llegaron al bundle, crashear con mensaje
// claro en vez de pasar undefined a createClient (que produce pantalla blanca).
//
// Las EXPO_PUBLIC_* viajan en el bundle cliente. Si no están, hay que revisar:
//   1. El .env existe y tiene las dos vars.
//   2. .easignore NO excluye .env (para EAS builds).
//   3. El proceso de Metro se recargó con --clear después de tocar .env.
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
    !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(', ');
  throw new Error(
    `[GetVision] Faltan variables de entorno: ${missing}. ` +
    `Verificá que el .env esté en el directorio raíz y que .easignore no lo excluya.`,
  );
}

// Fix OAuth web (2026-06-10):
//   - flowType 'pkce': el redirect de Google vuelve con `?code=` de un solo
//     uso en lugar de tokens en el hash (#access_token). Más seguro — ningún
//     token queda en historial del browser ni en logs — y es el flujo
//     recomendado por Supabase para SPAs.
//   - detectSessionInUrl true: al volver del OAuth la página recarga entera,
//     el cliente detecta el `?code=`, lo canjea por sesión y limpia la URL.
//     App.checkSession lo ve vía getSession() (espera la inicialización).
//   Con el valor previo (false) los tokens del redirect se descartaban y el
//   login con Google nunca establecía sesión en web.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
