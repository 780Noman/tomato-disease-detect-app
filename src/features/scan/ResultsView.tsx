import { Image, StyleSheet, View } from 'react-native';

import { Badge, Card, CategoryPill, ConfidenceBar, Text } from '@/components';
import { CLASS_INFO, categoryDisplayName, isLimitedDataClass } from '@/config/classes';
import {
  confidenceBand,
  confidenceBandLabel,
  displayPercent,
  TOP_PREDICTIONS_SHOWN,
} from '@/config/thresholds';
import type { Classification } from '@/inference';
import { radii, spacing } from '@/theme';

interface ResultsViewProps {
  readonly imageUri: string;
  readonly result: Classification;
}

/**
 * The honest results presentation (CLAUDE.md §7):
 * - category first — it decides pesticide vs fertiliser;
 * - top-3 ranked probabilities, never just the winner;
 * - low confidence is a first-class result, not an apologetic footnote;
 * - limited-data caveat for weakly-supported classes;
 * - a persistent note that healthy leaves are outside the model's world;
 * - no accuracy claim anywhere, whole percentages only.
 */
export function ResultsView({ imageUri, result }: ResultsViewProps) {
  const top = result.top;
  const topInfo = CLASS_INFO[top.classCode];
  const shown = result.scores.slice(0, TOP_PREDICTIONS_SHOWN);

  return (
    <View style={styles.stack} testID="results-view">
      <Image
        source={{ uri: imageUri }}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel="The analysed leaf photo"
      />

      {result.lowConfidence ? (
        <Card style={styles.card} testID="low-confidence-result">
          <Badge label="Uncertain" tone="warning" />
          <Text variant="heading">This leaf could not be classified reliably.</Text>
          <Text tone="muted">
            No prediction reached the confidence this app requires for a diagnosis. Consult an
            agricultural extension officer, and consider retaking the photo following the capture
            guide.
          </Text>
        </Card>
      ) : (
        <Card style={styles.card} testID="diagnosis-result">
          <CategoryPill label={categoryDisplayName(topInfo.category)} prominent />
          <Text variant="title">{topInfo.displayName}</Text>
          <Text tone="muted">
            {confidenceBandLabel(confidenceBand(top.probability))} ·{' '}
            {displayPercent(top.probability)}
          </Text>
          {isLimitedDataClass(top.classCode) ? (
            <View style={styles.caveat} testID="limited-data-caveat">
              <Badge label="Limited training data" tone="warning" />
              <Text variant="caption" tone="muted">
                This condition was learned from very few real examples. Have the result confirmed by
                an expert before acting on it.
              </Text>
            </View>
          ) : null}
        </Card>
      )}

      <Card style={styles.card}>
        <Text variant="heading">
          {result.lowConfidence ? 'Possibilities — not a diagnosis' : 'Top predictions'}
        </Text>
        {shown.map((score, index) => (
          <ConfidenceBar
            key={score.classCode}
            fraction={score.probability}
            label={CLASS_INFO[score.classCode].displayName}
            valueLabel={displayPercent(score.probability)}
            emphasized={index === 0 && !result.lowConfidence}
            testID={`prediction-${index}`}
          />
        ))}
      </Card>

      <Text variant="caption" tone="muted" style={styles.healthyNote} testID="no-healthy-note">
        This tool only distinguishes between six pest and deficiency conditions. It does not detect
        healthy leaves — a healthy leaf will still receive one of the six labels.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: '#201914',
  },
  card: { gap: spacing.sm },
  caveat: { gap: spacing.xs, marginTop: spacing.xs },
  healthyNote: { textAlign: 'center', paddingHorizontal: spacing.md },
});
