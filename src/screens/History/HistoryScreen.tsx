import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Badge,
  Card,
  CategoryPill,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
} from '@/components';
import { CLASS_INFO, categoryDisplayName } from '@/config/classes';
import { displayPercent } from '@/config/thresholds';
import { useHistoryStore } from '@/features/history/historyStore';
import type { SavedScan } from '@/features/history/types';
import { spacing } from '@/theme';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryScreen() {
  const navigation = useNavigation();
  const status = useHistoryStore((s) => s.status);
  const scans = useHistoryStore((s) => s.scans);
  const error = useHistoryStore((s) => s.error);
  const load = useHistoryStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <Screen scroll={false} testID="history-screen">
        <LoadingState message="Loading your scans…" testID="history-loading" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} testID="history-screen">
        <ErrorState
          title="History could not be loaded"
          message={error ?? 'The scan history database could not be read on this device.'}
          onRetry={() => void load()}
          testID="history-error"
        />
      </Screen>
    );
  }

  if (scans.length === 0) {
    return (
      <Screen scroll={false} testID="history-screen">
        <EmptyState
          title="No scans yet"
          message="Scans you save appear here and stay available with no connection."
          actionLabel="Scan a leaf"
          onAction={() => navigation.navigate('CaptureGuide')}
          testID="history-empty"
        />
      </Screen>
    );
  }

  return (
    <Screen testID="history-screen">
      <View style={styles.stack}>
        {scans.map((scan) => (
          <ScanRow
            key={scan.id}
            scan={scan}
            onPress={() => navigation.navigate('ScanDetail', { id: scan.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

function ScanRow({ scan, onPress }: { scan: SavedScan; onPress: () => void }) {
  const info = CLASS_INFO[scan.topClass];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={`scan-${scan.id}`}>
      <Card style={styles.card}>
        {scan.lowConfidence ? (
          <Badge label="Uncertain" tone="warning" />
        ) : (
          <CategoryPill label={categoryDisplayName(info.category)} />
        )}
        <Text variant="label">
          {scan.lowConfidence ? 'Not classified reliably' : info.displayName}
        </Text>
        <Text variant="caption" tone="muted">
          {formatDate(scan.createdAt)} · {displayPercent(scan.confidence)}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.xs },
});
