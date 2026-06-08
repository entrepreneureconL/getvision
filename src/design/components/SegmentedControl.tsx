/**
 * <SegmentedControl /> — toggle de 2-4 opciones estilo iPhone.
 *
 * El patrón "Week / Day" de iPhone Screen Time. La pieza clave del lenguaje
 * dinámico: la misma pantalla cambia de lente sin navegar a otra.
 *
 * Visual:
 *   Container pill, fondo bg.raised, padding chico.
 *   Segmento activo: fondo bg.elevated, texto primary.
 *   Segmentos inactivos: texto secondary, transparente.
 *
 * Por qué es genérico en `T`: el value puede ser cualquier tipo (string union,
 * enum, number). Así lo usamos para `'week'|'day'` o para keys de hero metric
 * (`'hourly_rate'|'daily_revenue'|...`) sin perder type safety.
 *
 * Uso:
 *   const [period, setPeriod] = useState<'week'|'day'>('day');
 *   <SegmentedControl
 *     value={period}
 *     onChange={setPeriod}
 *     options={[
 *       { value: 'week', label: 'Semana' },
 *       { value: 'day',  label: 'Día' },
 *     ]}
 *   />
 *
 *   <SegmentedControl
 *     value={metric}
 *     onChange={setMetric}
 *     options={metrics.map(m => ({ value: m.key, label: m.label }))}
 *     fullWidth
 *   />
 */

import { View, TouchableOpacity, type ViewStyle, type StyleProp } from 'react-native';
import { color, radius, space, text as tokenText } from '../tokens';
import DSText from './Text';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Size = 'sm' | 'md';

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: Size;
  /** Ocupa todo el ancho disponible. Default: true. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_HEIGHT: Record<Size, number> = {
  sm: 32,
  md: 40,
};

const SIZE_TEXT: Record<Size, number> = {
  sm: tokenText.size.sm,
  md: tokenText.size.md,
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  style,
}: Props<T>) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: color.bg.raised,
          borderRadius: radius.pill,
          padding: space['1'],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          gap: space['1'],
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
            style={{
              flex: fullWidth ? 1 : undefined,
              height: SIZE_HEIGHT[size],
              borderRadius: radius.pill,
              backgroundColor: isActive ? color.bg.elevated : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space['3'],
            }}
          >
            <DSText
              variant={size === 'sm' ? 'caption' : 'body'}
              color={isActive ? 'primary' : 'secondary'}
              style={{
                fontSize: SIZE_TEXT[size],
                fontWeight: isActive ? '600' : '500',
              }}
            >
              {opt.label}
            </DSText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
