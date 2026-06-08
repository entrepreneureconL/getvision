/**
 * <HighlightedText /> — pinta un substring dentro de un texto con un estilo
 * distinto. Útil para mostrar matches de búsqueda.
 *
 * Uso:
 *   <HighlightedText
 *     text="Peluquería"
 *     start={0}
 *     end={4}
 *     baseStyle={styles.itemText}
 *     highlightStyle={styles.match}
 *   />
 *   → renderiza "<bold>Pelu</bold>quería"
 */

import { Text, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  text: string;
  /** Índice de inicio del match (incluido). */
  start: number;
  /** Índice de fin del match (excluido). */
  end: number;
  baseStyle?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
};

export default function HighlightedText({
  text,
  start,
  end,
  baseStyle,
  highlightStyle,
}: Props) {
  // Defensa: si el rango es inválido, mostramos el texto sin highlight.
  if (start < 0 || end <= start || start >= text.length) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  const before = text.slice(0, start);
  const match  = text.slice(start, end);
  const after  = text.slice(end);

  return (
    <Text style={baseStyle}>
      {before}
      <Text style={highlightStyle}>{match}</Text>
      {after}
    </Text>
  );
}
