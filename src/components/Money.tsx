/**
 * <Money /> — formato monetario consistente para toda la app.
 *
 * Reglas (de la sección 4 del MASTER):
 *   - Locale es-AR siempre (1.234,56).
 *   - Negativos: entre paréntesis con (−), en rojo.
 *   - Positivos: verde (opcional, configurable).
 *   - Cero: gris neutro.
 *
 * Antes existían fmt() y fmtBalance() duplicados en DashboardScreen,
 * SaleForm, CostForm, MovementForm. Ahora un solo lugar.
 *
 * Uso:
 *   <Money amount={1234.56} />              → "1.234,56"
 *   <Money amount={-1234.56} colored />     → "(−1.234,56)" rojo
 *   <Money amount={1234.56} colored />      → "1.234,56" verde
 *   <Money amount={1234.56} prefix="$ " />  → "$ 1.234,56"
 *   <Money amount={0} colored />            → "0,00" gris
 *
 * Analogía Python: el equivalente a un helper format_currency(amount) pero
 * que además devuelve un widget con color. Como un f-string + estilo en uno.
 */

import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { color as dsColor } from '../design';

// D-10: los defaults vienen de los tokens del DS (antes hex hardcodeado
// pre-F1-D). Si la paleta semántica cambia, este componente la hereda.
const POSITIVE_COLOR = dsColor.success.base;
const NEGATIVE_COLOR = dsColor.danger.base;
const NEUTRAL_COLOR = dsColor.text.tertiary;

/** Ratio de tamaño de los decimales atenuados respecto del entero (G-6). */
const MUTED_DECIMALS_RATIO = 0.55;

type Props = {
  /** Monto en number. Puede ser negativo. */
  amount: number;
  /** Si true, aplica color según signo. Default: false (hereda color del padre). */
  colored?: boolean;
  /** Prefijo opcional (por ej "$ ", "USD ", "AR$ "). */
  prefix?: string;
  /** Sufijo opcional (por ej " ARS"). */
  suffix?: string;
  /** Estilo extra para mergear (tamaño, weight, etc). */
  style?: StyleProp<TextStyle>;
  /** Override del color cuando colored=true. */
  positiveColor?: string;
  /** Override del color cuando colored=true y negativo. */
  negativeColor?: string;
  /** G-6 (GETVISION_DESIGN) — decimales ",00" más chicos y apagados.
   *  El ojo va a los enteros; los centavos son ruido en montos héroe.
   *  Solo usar en montos grandes (2xl+). En listas densas, dejar default. */
  mutedDecimals?: boolean;
};

/** Separa el monto formateado en parte entera y decimal ("1.234,56" → ["1.234","56"]).
 *  Exportado para componentes que componen el monto a mano (MiPlataCard). */
export function splitMoneyParts(amount: number): { int: string; dec: string } {
  const formatted = formatMoney(amount);
  const [int, dec] = formatted.split(',');
  return { int, dec: dec ?? '00' };
}

export function formatMoney(amount: number): string {
  return Math.abs(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBalance(amount: number): string {
  const formatted = formatMoney(amount);
  return amount < 0 ? `(−${formatted})` : formatted;
}

export default function Money({
  amount,
  colored = false,
  prefix = '',
  suffix = '',
  style,
  positiveColor = POSITIVE_COLOR,
  negativeColor = NEGATIVE_COLOR,
  mutedDecimals = false,
}: Props) {
  let color: string | undefined;
  if (colored) {
    if (amount > 0) color = positiveColor;
    else if (amount < 0) color = negativeColor;
    else color = NEUTRAL_COLOR;
  }

  if (mutedDecimals) {
    // "(−1.234,56)" se descompone en: "(−1.234" + ",56" chico/atenuado + ")".
    // Feedback CEO 2026-06-11: los decimales heredan el MISMO color del entero
    // (verde con verde, no gris) — un dato, un matiz. La atenuación es por
    // tamaño + opacidad, nunca por cambio de color.
    const { int, dec } = splitMoneyParts(amount);
    const isNegative = amount < 0;
    const flat = StyleSheet.flatten(style) ?? {};
    const baseSize = typeof flat.fontSize === 'number' ? flat.fontSize : 15;
    const decStyle: TextStyle = {
      fontSize: Math.round(baseSize * MUTED_DECIMALS_RATIO),
      opacity: 0.55,
      fontWeight: '500',
    };
    return (
      <Text style={[color ? { color } : null, style]}>
        {prefix}{isNegative ? '(−' : ''}{int}
        <Text style={decStyle}>,{dec}</Text>
        {isNegative ? ')' : ''}{suffix}
      </Text>
    );
  }

  const text = `${prefix}${formatBalance(amount)}${suffix}`;

  return (
    <Text style={[color ? { color } : null, style]}>
      {text}
    </Text>
  );
}
