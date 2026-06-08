/**
 * productsRepo — acceso a la tabla products.
 *
 * Métricas para el dashboard (stock KPI):
 *   - totalProducts: cantidad de productos activos.
 *   - totalStockUnits: suma de stock_actual.
 *   - lowStockCount: cuántos productos están bajo su low_stock_threshold.
 *   - stockValueAtCost: valor inventario a precio costo.
 */

import { supabase } from '../lib/supabase';
import {
  parseProduct,
  parseProductList,
  ProductInsertSchema,
  type Product,
  type ProductInsert,
} from '../schemas/product';

const COLUMNS =
  'id, business_id, name, sku, stock_actual, unit_cost, unit_price, low_stock_threshold, active, created_at, updated_at';

export type StockSummary = {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  stockValueAtCost: number;
};

const EMPTY_SUMMARY: StockSummary = {
  totalProducts: 0,
  totalStockUnits: 0,
  lowStockCount: 0,
  stockValueAtCost: 0,
};

export const productsRepo = {
  /** Lista todos los productos activos del business, ordenados por nombre. */
  async listActive(businessId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(COLUMNS)
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[repo:products] listActive error:', error);
      return [];
    }
    return parseProductList(data);
  },

  /**
   * Resumen agregado de stock para el dashboard.
   * Hace una sola query y agrega en memoria. Para 100s de productos
   * funciona bien. Para 10K+ habría que mover a una RPC SQL.
   */
  async getStockSummary(businessId: string): Promise<StockSummary> {
    const products = await productsRepo.listActive(businessId);
    if (products.length === 0) return EMPTY_SUMMARY;

    const summary: StockSummary = { ...EMPTY_SUMMARY };
    summary.totalProducts = products.length;

    for (const p of products) {
      summary.totalStockUnits += p.stock_actual;
      if (p.unit_cost) {
        summary.stockValueAtCost += p.stock_actual * p.unit_cost;
      }
      const threshold = p.low_stock_threshold ?? 5;
      if (p.stock_actual <= threshold) {
        summary.lowStockCount += 1;
      }
    }
    return summary;
  },

  /**
   * Crear un producto rápido desde el dashboard.
   * Valida con zod antes de mandar a la DB.
   */
  async create(input: ProductInsert): Promise<Product | null> {
    const parsed = ProductInsertSchema.safeParse(input);
    if (!parsed.success) {
      console.error('[repo:products] create input inválido:', parsed.error.issues);
      return null;
    }

    const { data, error } = await supabase
      .from('products')
      .insert(parsed.data)
      .select(COLUMNS)
      .single();

    if (error) {
      console.error('[repo:products] create error:', error);
      return null;
    }
    return parseProduct(data);
  },
};
