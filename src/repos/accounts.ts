/**
 * accountsRepo — capa de acceso a la tabla `accounts` (F1-J).
 *
 * Qué es una `account` acá:
 *   El lugar físico donde el negocio guarda la plata (Efectivo, Mercado Pago,
 *   Banco Galicia, etc). NO es el "plan de cuentas" contable formal — es lo
 *   que el usuario percibe como "mi caja", "mi MP".
 *
 * El motor las usa para:
 *   1) Sumar el balance real de cada cuenta = initial_balance + lo que entró
 *      − lo que salió (solo transactions saldadas: settled_at IS NOT NULL).
 *   2) Mostrar "Plata Disponible" en el HeroDualCard (F1-J.5).
 *   3) Pre-seleccionar la cuenta default en SaleForm/CostForm cuando el
 *      usuario marca "Ya cobré / Ya pagué".
 *
 * En C++ esto sería más o menos:
 *   class AccountRepo {
 *     std::vector<Account> listActive(business_id);
 *     std::unordered_map<id, double> getBalances(business_id, asOf?);
 *   };
 * Pero acá todo es async (Promise<T>) porque las queries van a Supabase
 * por red, no a memoria local.
 */

import { supabase } from '../lib/supabase';
import {
  parseAccountList,
  parseAccount,
  type Account,
  type AccountKind,
} from '../schemas/account';

const ACCOUNT_COLUMNS =
  'id, business_id, name, kind, is_default, initial_balance, archived_at, created_at';

/**
 * Filas mínimas que devuelve Supabase para computar balances.
 * No usamos parseTransactionList acá para evitar dependencia circular
 * con transactions.ts: el cálculo de balance es estructural y solo precisa
 * 4 campos. Si alguno viene NULL, lo ignoramos en el reduce.
 */
type SettledRow = {
  amount: number | string;
  from_account_id: string | null;
  to_account_id: string | null;
};

export const accountsRepo = {
  /**
   * Lista todas las cuentas vivas (archived_at IS NULL) de un business.
   * Orden: default primero, luego por fecha de creación. Eso es lo que el form
   * va a mostrar en el chip-picker, así la cuenta sugerida queda izquierda.
   */
  async listActive(businessId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('business_id', businessId)
      .is('archived_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[repo:accounts] listActive error:', error);
      return [];
    }
    return parseAccountList(data);
  },

  /**
   * Balance por cuenta para un business.
   *   balance(account) = initial_balance
   *                    + Σ amount donde to_account_id   = account.id  (entradas)
   *                    − Σ amount donde from_account_id = account.id  (salidas)
   *   Solo cuentan las transactions con settled_at IS NOT NULL (plata real).
   *
   * `asOf` (opcional) permite calcular el balance a una fecha pasada — útil
   * para la línea de tiempo del HeroDualCard ("hace 7 días tenías X"). Si se
   * pasa, se filtra por settled_at <= asOf.
   *
   * Patrón:
   *   1) Una sola query a transactions (en vez de 1 por cuenta), agrega en JS.
   *   2) Devuelve un Record indexado por accountId, simple para consumer.
   *
   * Costo: O(n) donde n = transactions saldadas. Para PyMEs <= 1000/mes es
   * irrelevante. Si en F2 crece, migramos a una vista SQL o RPC con SUM().
   */
  async getBalances(
    businessId: string,
    asOf?: string,
  ): Promise<Record<string, number>> {
    const accounts = await accountsRepo.listActive(businessId);

    let query = supabase
      .from('transactions')
      .select('amount, from_account_id, to_account_id')
      .eq('business_id', businessId)
      .not('settled_at', 'is', null);

    if (asOf) {
      query = query.lte('settled_at', asOf);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[repo:accounts] getBalances error:', error);
      // Devolvemos balances solo con initial — degradado pero no roto.
      const fallback: Record<string, number> = {};
      for (const a of accounts) fallback[a.id] = a.initial_balance;
      return fallback;
    }

    // Arrancamos con initial_balance por cuenta y vamos sumando/restando.
    const balances: Record<string, number> = {};
    for (const a of accounts) balances[a.id] = a.initial_balance;

    const rows = (data ?? []) as SettledRow[];
    for (const r of rows) {
      const amount = typeof r.amount === 'string' ? Number(r.amount) : r.amount;
      if (!Number.isFinite(amount)) continue;
      if (r.to_account_id != null && balances[r.to_account_id] !== undefined) {
        balances[r.to_account_id] += amount;
      }
      if (r.from_account_id != null && balances[r.from_account_id] !== undefined) {
        balances[r.from_account_id] -= amount;
      }
    }

    return balances;
  },

  /**
   * F1-M Fase B (B5.2) — Variación neta por cuenta en un rango temporal.
   *
   * Devuelve un Record<accountId, delta> con la suma de movimientos settled
   * dentro del rango [start, end] inclusive:
   *   delta(account) = Σ amount donde to_account_id   = account  (entradas)
   *                  − Σ amount donde from_account_id = account  (salidas)
   *
   * Importante — diferencia con `getBalances`:
   *   • `getBalances`  = STOCK = initial_balance + acumulado hasta asOf.
   *   • `getVariations` = FLOW = solo movimientos dentro del rango. Sin initial.
   *
   * Es lo que necesita MiPlataCard refactorizado (post B5) para mostrar
   * "cuánto se movió cada cuenta este período".
   */
  async getVariations(
    businessId: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, number>> {
    const accounts = await accountsRepo.listActive(businessId);

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, from_account_id, to_account_id')
      .eq('business_id', businessId)
      .not('settled_at', 'is', null)
      .gte('settled_at', startDate)
      .lte('settled_at', endDate);

    if (error) {
      console.error('[repo:accounts] getVariations error:', error);
      const empty: Record<string, number> = {};
      for (const a of accounts) empty[a.id] = 0;
      return empty;
    }

    const variations: Record<string, number> = {};
    for (const a of accounts) variations[a.id] = 0;

    const rows = (data ?? []) as SettledRow[];
    for (const r of rows) {
      const amount = typeof r.amount === 'string' ? Number(r.amount) : r.amount;
      if (!Number.isFinite(amount)) continue;
      if (r.to_account_id != null && variations[r.to_account_id] !== undefined) {
        variations[r.to_account_id] += amount;
      }
      if (r.from_account_id != null && variations[r.from_account_id] !== undefined) {
        variations[r.from_account_id] -= amount;
      }
    }

    return variations;
  },

  /**
   * Crea una cuenta nueva. Devuelve el Account validado o null si falla.
   * Usado en F1-J.5 desde "Cuentas" en Settings (cuando agregamos UI).
   */
  async create(input: {
    business_id: string;
    name: string;
    kind: AccountKind;
    is_default?: boolean;
    initial_balance?: number;
  }): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        business_id: input.business_id,
        name: input.name,
        kind: input.kind,
        is_default: input.is_default ?? false,
        initial_balance: input.initial_balance ?? 0,
      })
      .select(ACCOUNT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[repo:accounts] create error:', error);
      return null;
    }
    return parseAccount(data);
  },

  /**
   * Update parcial. Solo campos editables.
   */
  async update(
    id: string,
    patch: {
      name?: string;
      kind?: AccountKind;
      is_default?: boolean;
      initial_balance?: number;
    },
  ): Promise<boolean> {
    const { error } = await supabase.from('accounts').update(patch).eq('id', id);
    if (error) {
      console.error('[repo:accounts] update error:', error);
      return false;
    }
    return true;
  },

  /**
   * Soft-delete: marca archived_at = now(). No borra física porque hay
   * transactions con FK → ON DELETE SET NULL que romperían la historia.
   */
  async archive(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('accounts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[repo:accounts] archive error:', error);
      return false;
    }
    return true;
  },

  /**
   * Red de seguridad: si por alguna razón un business no tiene cuentas
   * (ej. error en la migration, business creado entre migration y deploy),
   * crea las 3 default (Efectivo, MP, Banco).
   *
   * F1-Mfix: el chequeo `length === 0` del intento previo era frágil — si
   * dos callers entraban en paralelo (App.tsx + DashboardScreen.useEffect),
   * ambos pasaban el check y duplicaban las cuentas. Sin UNIQUE constraint
   * el DB tampoco lo prevenía. Síntoma: 6 cuentas en lugar de 3 y sumas
   * inconsistentes según cuál chip "Efectivo" eligiera el usuario.
   *
   * Fix actual:
   *   - Sigue siendo idempotente desde el lado de la app.
   *   - Cuando exista el UNIQUE(business_id, name, kind) en DB
   *     (post F1-Mfix_accounts_dedup.sql), el `ignoreDuplicates` evita el
   *     hard-error 23505 y la operación es no-op real para cuentas existentes.
   *   - Hasta que se aplique la migration, el check inicial sigue evitando
   *     escrituras en el camino feliz.
   */
  async ensureDefaultsForBusiness(businessId: string): Promise<void> {
    // Camino feliz: si ya hay cuentas, no insertamos nada (evita round-trip).
    const accounts = await accountsRepo.listActive(businessId);
    if (accounts.length > 0) return;

    const rows = [
      { business_id: businessId, name: 'Efectivo',     kind: 'cash' as const, is_default: true,  initial_balance: 0 },
      { business_id: businessId, name: 'Mercado Pago', kind: 'mp'   as const, is_default: false, initial_balance: 0 },
      { business_id: businessId, name: 'Banco',        kind: 'bank' as const, is_default: false, initial_balance: 0 },
    ];

    // upsert con onConflict + ignoreDuplicates: si una call paralela ya las
    // insertó entre el listActive y el upsert, no duplicamos. Requiere que
    // la UNIQUE constraint exista (F1-Mfix_accounts_dedup.sql).
    const { error } = await supabase
      .from('accounts')
      .upsert(rows, {
        onConflict: 'business_id,name,kind',
        ignoreDuplicates: true,
      });
    if (error) {
      console.error('[repo:accounts] ensureDefaultsForBusiness error:', error);
    }
  },
};
