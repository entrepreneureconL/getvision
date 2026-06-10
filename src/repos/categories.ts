/**
 * categoriesRepo — F1-L.
 *
 * Acceso a `category_overrides`. Una fila por business representa:
 *   - Custom (value libre, is_archived=false) → suma al picker.
 *   - Archive (value matchea default, is_archived=true) → oculta default del picker.
 *
 * El consumer principal es `getCategoriesForType(type, overrides)` en
 * `utils/transactionCategories.ts` que compone defaults + customs − archived
 * sin tocar DB (es pura). Acá solo cargamos/escribimos.
 */

import { supabase } from '../lib/supabase';
import {
  parseCategoryOverrideList,
  parseCategoryOverride,
  type CategoryOverride,
  type CategoryOverrideTint,
  type CategoryOverrideType,
} from '../schemas/categoryOverride';

const COLUMNS =
  'id, business_id, value, label, icon, tint, type, is_archived, suggested_from_rubro, created_at';

/**
 * Resultado discriminado para create/archiveDefault. Reemplaza el
 * `T | null` previo que tragaba el motivo del fallo (RLS vs duplicate vs zod).
 */
export type CategoryUpsertResult =
  | { ok: true; override: CategoryOverride }
  | { ok: false; code: 'duplicate' | 'rls' | 'parse' | 'unknown'; message: string };

/** Mapea un PostgrestError de Supabase al code+message para el UI. */
function classifySupabaseError(error: { code?: string; message?: string }): CategoryUpsertResult {
  // 23505 = unique_violation (Postgres)
  if (error?.code === '23505') {
    return { ok: false, code: 'duplicate', message: 'Ya tenés una categoría con ese nombre.' };
  }
  // 42501 = insufficient_privilege (RLS rechaza)
  if (error?.code === '42501') {
    return {
      ok: false, code: 'rls',
      message: 'No tenés permiso para crear esta categoría (sesión inválida o RLS).',
    };
  }
  return {
    ok: false, code: 'unknown',
    message: error?.message || 'Error desconocido al guardar la categoría.',
  };
}

export const categoriesRepo = {
  /**
   * Lista todos los overrides del business (customs + archives).
   * `getCategoriesForType` los combina con defaults.
   */
  async listForBusiness(businessId: string): Promise<CategoryOverride[]> {
    const { data, error } = await supabase
      .from('category_overrides')
      .select(COLUMNS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[repo:categories] listForBusiness error:', error);
      return [];
    }
    return parseCategoryOverrideList(data);
  },

  /**
   * Crea una categoría custom. El `value` debe ser único per business (DB lo
   * enforza). Devuelve un resultado discriminado — el caller usa el message
   * para decirle al usuario por qué falló (duplicate, RLS, etc.).
   */
  async create(input: {
    business_id: string;
    value: string;
    label: string;
    icon: string;
    tint: CategoryOverrideTint;
    type: CategoryOverrideType;
    suggested_from_rubro?: string | null;
  }): Promise<CategoryUpsertResult> {
    const { data, error } = await supabase
      .from('category_overrides')
      .insert({
        business_id: input.business_id,
        value: input.value,
        label: input.label,
        icon: input.icon,
        tint: input.tint,
        type: input.type,
        is_archived: false,
        suggested_from_rubro: input.suggested_from_rubro ?? null,
      })
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[repo:categories] create error:', error);
      return classifySupabaseError(error);
    }
    const parsed = parseCategoryOverride(data);
    if (!parsed) {
      return {
        ok: false, code: 'parse',
        message: 'Categoría creada pero su estructura es inválida (zod).',
      };
    }
    return { ok: true, override: parsed };
  },

  /**
   * Archive de un default — crea una fila con is_archived=true y el value del
   * default que se quiere ocultar. Si ya existe la fila, la marca como archivada.
   * Devuelve resultado discriminado (mismo patrón que create).
   */
  async archiveDefault(input: {
    business_id: string;
    value: string;
    label: string;
    icon: string;
    tint: CategoryOverrideTint;
    type: CategoryOverrideType;
  }): Promise<CategoryUpsertResult> {
    // Upsert: si ya existe (business_id, value), actualizar is_archived=true.
    // Si no, crear con is_archived=true.
    const { data, error } = await supabase
      .from('category_overrides')
      .upsert(
        {
          business_id: input.business_id,
          value: input.value,
          label: input.label,
          icon: input.icon,
          tint: input.tint,
          type: input.type,
          is_archived: true,
        },
        { onConflict: 'business_id,value' },
      )
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[repo:categories] archiveDefault error:', error);
      return classifySupabaseError(error);
    }
    const parsed = parseCategoryOverride(data);
    if (!parsed) {
      return {
        ok: false, code: 'parse',
        message: 'No se pudo procesar la respuesta del archive.',
      };
    }
    return { ok: true, override: parsed };
  },

  /**
   * Toggle is_archived. Útil en el editor de Settings para alternar visibilidad
   * de una categoría existente (custom o archive de default).
   */
  async setArchived(id: string, isArchived: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('category_overrides')
      .update({ is_archived: isArchived })
      .eq('id', id);
    if (error) {
      console.error('[repo:categories] setArchived error:', error);
      return false;
    }
    return true;
  },

  /**
   * Edición de label/icon/tint de una custom existente. No permite cambiar
   * el value (mantener integridad referencial con transactions).
   */
  async update(
    id: string,
    patch: { label?: string; icon?: string; tint?: CategoryOverrideTint },
  ): Promise<boolean> {
    const { error } = await supabase
      .from('category_overrides')
      .update(patch)
      .eq('id', id);
    if (error) {
      console.error('[repo:categories] update error:', error);
      return false;
    }
    return true;
  },

  /**
   * Borrado físico de una custom. Las transactions con ese value siguen
   * apuntando al string libre — el LEGACY_MAP / fallback de resolveCategory
   * cubre el display.
   */
  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('category_overrides')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[repo:categories] remove error:', error);
      return false;
    }
    return true;
  },
};
