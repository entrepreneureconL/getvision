/**
 * Design System — barrel export.
 *
 * Punto único de entrada para tokens y primitivos. Usá imports cortos:
 *   import { color, space, Heading, Card, Button, Stack } from '../design';
 *
 * NO importar piezas individuales desde sus archivos a menos que necesites
 * el `default export` del archivo (caso raro).
 *
 * Status F1-D + D-2: tokens + 10 primitivos.
 *   Texto/Layout:  Heading, Text, Stack, Divider
 *   Superficies:   Card
 *   Acción:        Button
 *   Forms:         Input
 *   Estado/Filtro: SegmentedControl, Chip
 *   Datos:         PeriodBars (D-2, GETVISION_DESIGN §4.3)
 *   Navegación:    TabBar (D-4, ADR #13)
 */

export { color, space, radius, text, shadow, breakpoint, tokens } from './tokens';
export type { SpaceKey, RadiusKey, SizeKey, WeightKey } from './tokens';
export type { PeriodBarPoint } from './components/PeriodBars';

export { default as Heading } from './components/Heading';
export { default as Text } from './components/Text';
export { default as Stack } from './components/Stack';
export { default as Divider } from './components/Divider';
export { default as Card } from './components/Card';
export { default as Button } from './components/Button';
export { default as Input } from './components/Input';
export { default as SegmentedControl } from './components/SegmentedControl';
export { default as Chip } from './components/Chip';
export { default as PeriodBars } from './components/PeriodBars';
export { default as TabBar } from './components/TabBar';
export type { TabItem } from './components/TabBar';
export { default as SideNav } from './components/SideNav';
export { default as ProportionList } from './components/ProportionList';
export type { ProportionItem } from './components/ProportionList';
