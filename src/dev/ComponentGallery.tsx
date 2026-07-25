import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  CategoryPill,
  ConfidenceBar,
  EmptyState,
  ErrorState,
  LoadingState,
  Logo,
  Screen,
  Text,
} from '@/components';
import { spacing, ThemeProvider, type ColorScheme } from '@/theme';

/**
 * Dev-only gallery rendering every shared component in every state, in both
 * themes. Not reachable in production builds (guarded in App.tsx).
 */
export function ComponentGallery() {
  const [scheme, setScheme] = useState<ColorScheme>('light');

  return (
    <ThemeProvider forcedScheme={scheme}>
      <Screen testID="component-gallery">
        <View style={styles.stack}>
          <View style={styles.header}>
            <Logo size={56} />
            <Text variant="title">Component Gallery</Text>
            <Text tone="muted">Dev only — every component, every state, both themes.</Text>
            <Button
              label={scheme === 'light' ? 'Switch to dark' : 'Switch to light'}
              variant="secondary"
              onPress={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
            />
          </View>

          <Section title="Text">
            <Text variant="title">Title</Text>
            <Text variant="heading">Heading</Text>
            <Text variant="body">Body — warm ink on warm sand.</Text>
            <Text variant="label">Label</Text>
            <Text variant="caption" tone="muted">
              Caption, muted
            </Text>
            <Text tone="primary">Primary tone</Text>
            <Text tone="accent">Accent (text-grade sage)</Text>
            <Text tone="success">Success tone</Text>
            <Text tone="warning">Warning tone (text-grade)</Text>
            <Text tone="danger">Danger tone</Text>
          </Section>

          <Section title="Buttons">
            <Button label="Primary" onPress={noop} />
            <Button label="Secondary" variant="secondary" onPress={noop} />
            <Button label="Ghost" variant="ghost" onPress={noop} />
            <Button label="Danger" variant="danger" onPress={noop} />
            <Button label="Disabled" onPress={noop} disabled />
            <Button label="Loading" onPress={noop} loading />
          </Section>

          <Section title="Badges & category pills">
            <Badge label="Neutral" />
            <Badge label="Primary" tone="primary" />
            <Badge label="Success" tone="success" />
            <Badge label="Limited training data" tone="warning" />
            <Badge label="Error" tone="danger" />
            <CategoryPill label="Insect Pest" prominent />
            <CategoryPill label="Nutrient Deficiency" />
          </Section>

          <Section title="Confidence bars (top-3 shape)">
            <ConfidenceBar fraction={0.72} label="Leaf Miner" valueLabel="72%" emphasized />
            <ConfidenceBar fraction={0.18} label="Mite" valueLabel="18%" />
            <ConfidenceBar fraction={0.06} label="Jassid + Mite" valueLabel="6%" />
          </Section>

          <Section title="Loading / error / empty states">
            <View style={styles.stateBox}>
              <LoadingState message="Analysing leaf…" />
            </View>
            <View style={styles.stateBox}>
              <ErrorState
                title="Server unreachable"
                message="The diagnosis server did not respond. Check your connection and retry."
                onRetry={noop}
              />
            </View>
            <View style={styles.stateBox}>
              <EmptyState
                title="No scans yet"
                message="Your saved scans will appear here."
                actionLabel="Scan a leaf"
                onAction={noop}
              />
            </View>
          </Section>
        </View>
      </Screen>
    </ThemeProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text variant="heading">{title}</Text>
      <View style={styles.stack}>{children}</View>
    </Card>
  );
}

function noop() {}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  stack: { gap: spacing.md },
  section: { gap: spacing.md },
  stateBox: { minHeight: 220 },
});
