import { useRoute, type RouteProp } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Badge, Card, CategoryPill, Screen, Text } from '@/components';
import { CLASS_INFO, categoryDisplayName, isLimitedDataClass } from '@/config/classes';
import { GUIDANCE_SCOPE_NOTE, libraryEntry } from '@/features/library/catalog';
import { spacing } from '@/theme';

export function DiseaseDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DiseaseDetail'>>();
  const entry = libraryEntry(route.params.code);
  const info = CLASS_INFO[entry.code];

  return (
    <Screen testID="disease-detail-screen">
      <View style={styles.stack}>
        <CategoryPill label={categoryDisplayName(info.category)} prominent />
        <Text variant="title">{entry.displayName}</Text>
        <Text tone="muted">{entry.whatItIs}</Text>

        {isLimitedDataClass(entry.code) ? (
          <View style={styles.caveat} testID="library-limited-data">
            <Badge label="Limited training data" tone="warning" />
            <Text variant="caption" tone="muted">
              The model saw very few real examples of this condition, so predictions naming it
              should be confirmed by an expert.
            </Text>
          </View>
        ) : null}

        <Card style={styles.card}>
          <Text variant="heading">Symptoms</Text>
          {entry.symptoms.map((symptom) => (
            <Text key={symptom} tone="muted">
              • {symptom}
            </Text>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text variant="heading">What you can do now</Text>
          {entry.culturalControls.map((control) => (
            <Text key={control} tone="muted">
              • {control}
            </Text>
          ))}
          <Text variant="caption" tone="muted">
            {GUIDANCE_SCOPE_NOTE}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="heading">Easily confused with</Text>
          {entry.confusedWith.map((other) => (
            <Text key={other} tone="muted">
              • {other}
            </Text>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.sm },
  caveat: { gap: spacing.xs },
});
