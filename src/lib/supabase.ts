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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
