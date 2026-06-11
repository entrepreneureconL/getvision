/**
 * StatsScreen — tab Estadísticas (D-4 v1).
 *
 * Hogar definitivo de la HeroMetricCard que F1-M Fase A sacó del Dashboard
 * simple ("Tu hora rinde", "Ticket promedio", etc. según subrubro). El
 * Dashboard responde "¿cómo va mi plata?"; Stats responde "¿cómo rinde mi
 * negocio?".
 *
 * v1 deliberadamente chica: hero metric + selector de período. El roadmap
 * D-6 (GETVISION_DESIGN §8) le suma barras apiladas por categoría, listas
 * con proporción y el chip "Año" que salió del dashboard en G-1.
 */

import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { analyticsRepo, type MetricResultWithPeriod } from '../repos/analytics';
import type { Business } from '../utils/businessProfile';
import type { Period } from '../utils/periods';
import HeroMetricCard from '../components/HeroMetricCard';
import Container from '../components/Container';
import {
  Heading,
  Text,
  SegmentedControl,
  color,
  space,
} from '../design';

type Props = {
  business: Business;
};

export default function StatsScreen({ business }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [metric, setMetric] = useState<MetricResultWithPeriod | null>(null);

  const load = useCallback(async (p: Period) => {
    const result = await analyticsRepo.getHeroMetricForPeriod(business, p);
    setMetric(result);
  }, [business]);

  useEffect(() => { load(period); }, [load, period]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Container>
          <Heading level={2}>Estadísticas</Heading>
          <Text variant="caption" color="tertiary" style={{ marginBottom: space['4'] }}>
            Cómo rinde tu negocio, más allá del día a día.
          </Text>

          <SegmentedControl<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
            ]}
          />

          <View style={{ marginTop: space['4'] }}>
            {metric ? (
              <HeroMetricCard
                metric={metric}
                comparison={null}
                previousLabel={undefined}
              />
            ) : (
              <Text variant="caption" color="tertiary" align="center">
                Cargando...
              </Text>
            )}
          </View>

          <Text
            variant="caption"
            color="tertiary"
            align="center"
            style={{ marginTop: space['6'] }}
          >
            Más estadísticas en camino: composición por etiqueta,{'\n'}
            comparativas anuales y rendimiento por hora.
          </Text>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg.base },
  scroll: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40 },
});
