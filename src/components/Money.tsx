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

import { Text, type TextStyle, type StyleProp } from 'react-native';

const POSITIVE_COLOR = '#27AE60'; // verde "ingresos"
const NEGATIVE_COLOR = '#C0392B'; // rojo "alerta"
const NEUTRAL_COLOR = '#7F8C8D';  // gris "cero/neutro"

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
};

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
}: Props) {
  const text = `${prefix}${formatBalance(amount)}${suffix}`;

  let color: string | undefined;
  if (colored) {
    if (amount > 0) color = positiveColor;
    else if (amount < 0) color = negativeColor;
    else color = NEUTRAL_COLOR;
  }

  return (
    <Text style={[color ? { color } : null, style]}>
      {text}
    </Text>
  );
}
