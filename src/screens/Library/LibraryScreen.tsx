import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, CategoryPill, Screen, Text } from '@/components';
import { CLASS_INFO, categoryDisplayName } from '@/config/classes';
import { LIBRARY } from '@/features/library/catalog';
import { spacing } from '@/theme';

/** Reference library for all six conditions. Fully offline. */
export function LibraryScreen() {
  const navigation = useNavigation();

  return (
    <Screen testID="library-screen">
      <View style={styles.stack}>
        <Text tone="muted">
          The six conditions this app distinguishes. Healthy leaves are not among them — the model
          was trained without a healthy class.
        </Text>
        {LIBRARY.map((entry) => (
          <Pressable
            key={entry.code}
            accessibilityRole="button"
            onPress={() => navigation.navigate('DiseaseDetail', { code: entry.code })}
            testID={`library-${entry.code}`}
          >
            <Card style={styles.card}>
              <CategoryPill label={categoryDisplayName(CLASS_INFO[entry.code].category)} />
              <Text variant="label">{entry.displayName}</Text>
              <Text variant="caption" tone="muted">
                {entry.whatItIs}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.xs },
});
