/**
 * <PeriodBalanceCard /> — balance consolidado del período (F1-M Fase A · A2).
 *
 * Vive entre los dos MonthFlowCard (Ingresos y Costos) y contesta la pregunta
 * "¿este mes terminó a favor o en contra?". Es derivada — no consulta DB.
 *
 * Visual: card más chica que un MonthFlow (padding md vs lg, valor 3xl vs 4xl)
 * para que la jerarquía de lectura sea Ingresos > Balance > Costos.
 *
 * Reglas de color (consistente con MASTER §13 honestidad numérica):
 *   - balance > 0  → success (verde)
 *   - balance < 0  → danger  (rojo)
 *   - balance == 0 → text.secondary (gris)
 *
 * El sub-texto "margen X%" aparece solo si income > 0 — sin ingresos no hay
 * margen calculable. Es informativo: (balance / income) * 100.
 */

import { View } from 'react-native';
import type { Period } from '../utils/periods';
import Money from './Money';
import {
  Text,
  Card,
  color,
  space,
  text as tokenText,
} from '../design';

type Props = {
  income: number;
  expense: number;
  period: Period;
};

const PERIOD_LABEL: Record<Period, string> = {
  day:   'Balance del día',
  week:  'Balance de la semana',
  month: 'Balance del mes',
};

export default function PeriodBalanceCard({ income, expense, period }: Props) {
  const balance = income - expense;

  let balanceColor: string = color.text.secondary;
  if (balance > 0) balanceColor = color.success.base;
  else if (balance < 0) balanceColor = color.danger.base;

  // Tamaño 2xl (24px) + padding sm: la card es claramente subordinada a MiPlata
  // (44px, 5xl) y MonthFlow (36px, 4xl). Cierra el cálculo como resumen, no
  // compite con ellas por atención visual.
  const displayStyle = {
    fontSize: tokenText.size['2xl'],
    lineHeight: tokenText.lineHeight['2xl'],
    fontWeight: tokenText.weight.bold as '700',
    letterSpacing: tokenText.letterSpacing.tight,
    color: balanceColor,
  };

  // Margen = balance / income. Solo se muestra si income > 0.
  // Redondeo a entero — un decimal es ruido visual en este contexto.
  const marginPct = income > 0 ? Math.round((balance / income) * 100) : null;

  return (
    <Card variant="surface" padding="sm">
      <Text variant="micro" color="secondary" uppercase>
        ⚖️  {PERIOD_LABEL[period]}
      </Text>

      <View style={{ marginTop: space['2'] }}>
        <Money amount={balance} prefix="$ " style={displayStyle} />
      </View>

      {marginPct !== null ? (
        <Text variant="caption" color="tertiary" style={{ marginTop: space['1'] }}>
          {marginPct >= 0 ? '+' : ''}{marginPct}% margen
        </Text>
      ) : null}
    </Card>
  );
}
