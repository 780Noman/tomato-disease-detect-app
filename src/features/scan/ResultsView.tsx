import { StyleSheet, View } from 'react-native';

import { Badge, Card, CategoryPill, ConfidenceBar, PhotoFrame, Text } from '@/components';
import { CLASS_INFO, categoryDisplayName } from '@/config/classes';
import {
  confidenceBand,
  confidenceBandLabel,
  displayPercent,
  TOP_PREDICTIONS_SHOWN,
} from '@/config/thresholds';
import type { Classification } from '@/inference';
import { spacing } from '@/theme';

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
      {/* The whole image that was analysed, uncropped. */}
      <PhotoFrame
        source={{ uri: imageUri }}
        accessibilityLabel="The analysed leaf photo"
        testID="analysed-photo"
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
          {/*
            Owner decision 2026-07-25: the "Limited training data" badge and
            its explanation were removed. One short line to consult an expert
            replaces them, and it shows on every diagnosis rather than only on
            weakly-supported classes.
          */}
          <Text variant="caption" tone="muted" testID="expert-advice">
            Consult an agricultural extension officer before acting on this result.
          </Text>
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
  card: { gap: spacing.sm },
  healthyNote: { textAlign: 'center', paddingHorizontal: spacing.md },
});
