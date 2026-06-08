/**
 * businessesRepo — capa de acceso a la tabla `businesses`.
 *
 * Regla: ningún componente debe llamar supabase.from('businesses') directo.
 * Toda lectura/escritura de businesses pasa por acá.
 *
 * Beneficios:
 *   1. Centraliza validación zod (parseBusiness) — los componentes reciben
 *      Business validado o null, nunca raw.
 *   2. Si mañana cambiamos el backend, tocamos UN archivo.
 *   3. Tipos consistentes. El componente no tiene que saber qué columnas
 *      pedir en el select.
 *
 * Analogía C++: como una clase Repository<Business> con métodos estáticos.
 * Analogía Python: un módulo con funciones puras que hablan con la DB.
 */

import { supabase } from '../lib/supabase';
import { parseBusiness, type Business } from '../schemas/business';

// Las columnas que pedimos siempre. Si agregamos una, la sumamos acá una vez.
const COLUMNS =
  'id, name, sector, rubro, subrubro, income_model, onboarding_completed, ' +
  'detail_level, operator_role, threshold_hourly_rate';

export const businessesRepo = {
  /**
   * Devuelve el business del usuario actual, o null si no existe.
   * Usa maybeSingle() para evitar error 406 cuando no hay filas.
   */
  async getByUserId(userId: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from('businesses')
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[repo:businesses] getByUserId error:', error);
      return null;
    }
    if (!data) return null;
    return parseBusiness(data);
  },

  /**
   * Crea un business vacío para el usuario. Se usa cuando getByUserId
   * devuelve null (primer login).
   */
  async createEmpty(userId: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from('businesses')
      .insert({ user_id: userId, name: 'Mi Negocio' })
      .select(COLUMNS)
      .single();

    if (error) {
      console.error('[repo:businesses] createEmpty error:', error);
      return null;
    }
    return parseBusiness(data);
  },

  /**
   * Helper combinado: obtiene el business del usuario, lo crea si no existe.
   * Esta era la lógica duplicada en App.tsx y DashboardScreen.tsx.
   * Acá vive una sola vez.
   */
  async ensureForUser(userId: string): Promise<Business | null> {
    const existing = await businessesRepo.getByUserId(userId);
    if (existing) return existing;
    return businessesRepo.createEmpty(userId);
  },

  /**
   * Actualiza campos parciales del business. Útil para Settings y onboarding.
   */
  async update(id: string, patch: Partial<Business>): Promise<Business | null> {
    const { data, error } = await supabase
      .from('businesses')
      .update(patch)
      .eq('id', id)
      .select(COLUMNS)
      .single();

    if (error) {
      console.error('[repo:businesses] update error:', error);
      return null;
    }
    return parseBusiness(data);
  },
};
