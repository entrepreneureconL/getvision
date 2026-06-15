/**
 * formatCompactMoney — monto en formato compacto es-AR (D-23.b).
 *
 * Para celdas chicas donde el monto completo no entra (calendario expandido):
 * "$64k", "$523k", "$1,2M". Devuelve la MAGNITUD con `$` y sufijo k/M — el
 * signo/dirección lo agrega el caller (flecha ↑/↓ o prefijo +/−), igual que
 * <Money/> separa el signo del número.
 *
 * No reemplaza a `formatMoney` (el formato completo con miles/decimales sigue
 * siendo el canónico para montos héroe); este es solo para densidad.
 */

export function formatCompactMoney(n: number): string {
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    // 1 decimal salvo que sea >= 10M (ahí el decimal es ruido). Coma es-AR.
    const txt = (m >= 10 ? Math.round(m).toString() : m.toFixed(1)).replace('.', ',');
    return `$${txt}M`;
  }

  if (abs >= 1_000) {
    return `$${Math.round(abs / 1000)}k`;
  }

  return `$${Math.round(abs)}`;
}

/**
 * formatFullMoney — variante COMPLETA del anterior: número entero con
 * separadores de miles es-AR y `$`, SIN abreviar y SIN decimales ("$842.000").
 *
 * Para el pie ("índice") del calendario expandido, donde el CEO pidió ver el
 * total real y no la magnitud `k/M` (issue 1, 2026-06-13). Solo el pie usa
 * esto; la grilla (montos por día + columna semanal) sigue en compacto para no
 * romper el ancho/peso en móvil.
 *
 * Devuelve la MAGNITUD (igual contrato que `formatCompactMoney`): el signo o la
 * flecha ↑/↓ los agrega el caller. Sin decimales — los centavos son ruido en
 * este resumen (los montos héroe con ",00" viven en <Money/>).
 */
export function formatFullMoney(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;
}
