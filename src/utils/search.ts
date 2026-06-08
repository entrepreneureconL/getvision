/**
 * search.ts — utility de búsqueda transversal sobre la estructura
 * SECTORS / RUBROS / SUBRUBROS.
 *
 * Diseñado para el buscador del onboarding (F0-10).
 *
 * Características:
 *   - Match case-insensitive y diacritic-tolerant ("peluqueria" == "Peluquería").
 *   - Match parcial: "pel" matchea "Peluquería", "Belleza", "Papelería".
 *   - Cada resultado lleva su jerarquía completa para auto-completar.
 *   - Resultados ordenados: subrubros primero (más específicos),
 *     luego rubros, luego sectores.
 */

import { SECTORS, RUBROS, SUBRUBROS } from './businessProfile';

/** Quita acentos/diacritics y baja a minúsculas. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export type SearchResult = {
  /** Nivel del match. Subrubro > rubro > sector en specificity. */
  level: 'sector' | 'rubro' | 'subrubro';

  /** El nombre que se mostró y matcheó (en su forma original con tildes). */
  label: string;

  /** Posición del match dentro de `label` (para resaltar). */
  matchStart: number;
  matchEnd: number;

  /** Jerarquía completa para auto-completar el form. */
  sector: string;          // 'commerce'
  sectorLabel: string;     // 'Comercio'
  rubro?: string;          // 'Belleza y Estética' (solo si level === 'rubro' o 'subrubro')
  subrubro?: string;       // 'Peluquería' (solo si level === 'subrubro')
};

/** Lookup helper: sector key → label visible. */
function getSectorLabel(key: string): string {
  return SECTORS.find(s => s.key === key)?.label ?? key;
}

/** Si normalize(haystack) contiene normalize(needle), devuelve el índice; sino -1. */
function findMatch(haystack: string, needle: string): number {
  if (!needle) return -1;
  return normalize(haystack).indexOf(normalize(needle));
}

/** Busca el rubro al que pertenece un subrubro. */
function findParentRubro(subrubro: string): string | null {
  for (const [rubro, subs] of Object.entries(SUBRUBROS)) {
    if (subs.includes(subrubro)) return rubro;
  }
  return null;
}

/** Busca el sector al que pertenece un rubro. */
function findParentSector(rubro: string): string | null {
  for (const [sector, rubros] of Object.entries(RUBROS)) {
    if (rubros.includes(rubro)) return sector;
  }
  return null;
}

/**
 * searchAllLevels — busca el query en todas las capas y devuelve resultados
 * con jerarquía resuelta.
 *
 * @param query texto que tipea el usuario
 * @param options.visibleSectors si se pasa, filtra resultados cuyo sector
 *   no esté en la lista. Se usa cuando ocultamos Industria/Agro en F0.
 */
export function searchAllLevels(
  query: string,
  options: { visibleSectors?: string[] } = {},
): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];
  const inVisibleSector = (sectorKey: string) =>
    !options.visibleSectors || options.visibleSectors.includes(sectorKey);

  // ───── Subrubros (más específico, prioridad más alta) ─────
  for (const [rubro, subs] of Object.entries(SUBRUBROS)) {
    const sector = findParentSector(rubro);
    if (!sector || !inVisibleSector(sector)) continue;

    for (const subrubro of subs) {
      const idx = findMatch(subrubro, q);
      if (idx >= 0) {
        results.push({
          level: 'subrubro',
          label: subrubro,
          matchStart: idx,
          matchEnd: idx + q.length,
          sector,
          sectorLabel: getSectorLabel(sector),
          rubro,
          subrubro,
        });
      }
    }
  }

  // ───── Rubros ─────
  for (const [sector, rubros] of Object.entries(RUBROS)) {
    if (!inVisibleSector(sector)) continue;
    for (const rubro of rubros) {
      const idx = findMatch(rubro, q);
      if (idx >= 0) {
        results.push({
          level: 'rubro',
          label: rubro,
          matchStart: idx,
          matchEnd: idx + q.length,
          sector,
          sectorLabel: getSectorLabel(sector),
          rubro,
        });
      }
    }
  }

  // ───── Sectores ─────
  for (const s of SECTORS) {
    if (!inVisibleSector(s.key)) continue;
    const idx = findMatch(s.label, q);
    if (idx >= 0) {
      results.push({
        level: 'sector',
        label: s.label,
        matchStart: idx,
        matchEnd: idx + q.length,
        sector: s.key,
        sectorLabel: s.label,
      });
    }
  }

  return results;
}
