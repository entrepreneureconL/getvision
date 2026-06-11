/**
 * MainTabs — contenedor de las 4 tabs principales (D-4, ADR #13).
 *
 * Estructura post-login + onboarding:
 *   ┌──────────────────────────────┐
 *   │  pantalla de la tab activa   │  ← flex: 1
 *   ├──────────────────────────────┤
 *   │ Inicio Movim. Stats Perfil   │  ← <TabBar/> (DS #11)
 *   └──────────────────────────────┘
 *
 * La TabBar es layout (no overlay): el contenido termina ARRIBA de la barra,
 * así el FAB del Dashboard (absolute bottom:24 dentro de su SafeAreaView)
 * queda automáticamente por encima de la barra sin offsets mágicos.
 *
 * Navegación interna:
 *   - Dashboard onOpenHistory(filter) → tab Movimientos con ese filtro.
 *   - Dashboard onOpenSettings → tab Perfil.
 *   - Tab Movimientos sin filtro → HistoryFilter sentinel ALL_KEY (todos).
 *   - Volver a tocar la tab Movimientos estando en ella → resetea al filtro
 *     "todos" (patrón iOS: re-tap = volver a la raíz de la tab).
 *
 * App.tsx conserva la máquina de estados para el flujo de auth
 * (welcome/login/onboarding) — esto solo reemplaza la zona logueada.
 */

import { useState } from 'react';
import { View } from 'react-native';
import DashboardScreen from './DashboardScreen';
import HistoryScreen from './HistoryScreen';
import StatsScreen from './StatsScreen';
import SettingsScreen from './SettingScreen';
import { ALL_KEY, type HistoryFilter } from '../utils/historyFilters';
import type { Business } from '../utils/businessProfile';
import { TabBar, color, type TabItem } from '../design';

type TabKey = 'home' | 'movements' | 'stats' | 'profile';

const TAB_ITEMS: TabItem<TabKey>[] = [
  { key: 'home',      label: 'Inicio',      icon: 'home-outline',        iconActive: 'home' },
  { key: 'movements', label: 'Movimientos', icon: 'list-outline',        iconActive: 'list' },
  { key: 'stats',     label: 'Stats',       icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'profile',   label: 'Perfil',      icon: 'person-outline',      iconActive: 'person' },
];

/** Filtro raíz de la tab Movimientos: todo el mes, sin eje. */
const ALL_FILTER: HistoryFilter = {
  type: 'all',
  axis: 'channel',
  key: ALL_KEY,
  label: 'Todos los movimientos',
  period: 'month',
};

type Props = {
  businessId: string;
  business: Business;
  onSignOut: () => void;
  /** Recarga el business tras guardar en Perfil (lo maneja App). */
  onSettingsSaved: () => void;
};

export default function MainTabs({
  businessId,
  business,
  onSignOut,
  onSettingsSaved,
}: Props) {
  const [tab, setTab] = useState<TabKey>('home');
  // Filtro vivo de la tab Movimientos. Cambia cuando el Dashboard manda un
  // tap-to-history; el re-tap de la tab lo resetea a ALL_FILTER.
  const [movementsFilter, setMovementsFilter] = useState<HistoryFilter>(ALL_FILTER);

  const handleTabChange = (next: TabKey) => {
    if (next === 'movements' && tab === 'movements') {
      setMovementsFilter(ALL_FILTER); // re-tap = raíz de la tab
    }
    setTab(next);
  };

  const openHistory = (filter: HistoryFilter) => {
    setMovementsFilter(filter);
    setTab('movements');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg.base }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' ? (
          <DashboardScreen
            onSignOut={onSignOut}
            onOpenSettings={() => setTab('profile')}
            onOpenHistory={openHistory}
          />
        ) : null}

        {tab === 'movements' ? (
          <HistoryScreen
            key={`${movementsFilter.key}-${movementsFilter.type}-${movementsFilter.label}`}
            businessId={businessId}
            initialFilter={movementsFilter}
            onBack={
              movementsFilter.key === ALL_KEY
                ? undefined // raíz de la tab: no hay "volver"
                : () => setMovementsFilter(ALL_FILTER)
            }
          />
        ) : null}

        {tab === 'stats' ? <StatsScreen business={business} /> : null}

        {tab === 'profile' ? (
          <SettingsScreen
            businessId={businessId}
            onBack={() => setTab('home')}
            onSaved={onSettingsSaved}
          />
        ) : null}
      </View>

      <TabBar items={TAB_ITEMS} active={tab} onChange={handleTabChange} />
    </View>
  );
}
