import { StyleSheet, View } from 'react-native';

import { ResultsView } from './ResultsView';
import { Text } from '@/components';
import type { SavedScan } from '@/features/history/types';
import type { Classification } from '@/inference';
import { spacing } from '@/theme';

/**
 * Renders a stored scan through exactly the same presentation as a live
 * result, so the honesty rules cannot drift between the two paths. Adds one
 * note a live result never needs: whether the class order was unverified
 * when the scan was taken.
 */
export function SavedResultView({ scan }: { scan: SavedScan }) {
  const result: Classification = {
    scores: [...scan.scores].sort((a, b) => b.probability - a.probability),
    top: { classCode: scan.topClass, probability: scan.confidence },
    lowConfidence: scan.lowConfidence,
    provider: scan.provider,
    modelVersion: scan.modelVersion,
    durationMs: 0,
  };

  return (
    <View style={styles.stack}>
      {!scan.classOrderVerified ? (
        <Text variant="caption" tone="danger" testID="unverified-scan-note">
          This scan was recorded while the model&apos;s class order was still unverified, so the
          label may not correspond to the correct condition. Kept for reference only.
        </Text>
      ) : null}
      <ResultsView imageUri={scan.imagePath} result={result} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
});
