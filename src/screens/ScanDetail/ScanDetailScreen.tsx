import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { GUIDANCE_SCOPE_NOTE, libraryEntry } from '@/features/library/catalog';
import { getScanRepository } from '@/features/history/repository';
import { useHistoryStore } from '@/features/history/historyStore';
import type { SavedScan } from '@/features/history/types';
import { useExportReport } from '@/features/report/useExportReport';
import { SavedResultView } from '@/features/scan/SavedResultView';
import { spacing } from '@/theme';

type LoadState =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly message: string }
  | { readonly state: 'missing' }
  | { readonly state: 'ready'; readonly scan: SavedScan };

export function ScanDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ScanDetail'>>();
  const { id } = route.params;
  const remove = useHistoryStore((s) => s.remove);
  const { status: exportStatus, error: exportError, exportReport } = useExportReport();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const repository = await getScanRepository();
        const scan = await repository.get(id);
        if (!active) return;
        setLoad(scan === null ? { state: 'missing' } : { state: 'ready', scan });
      } catch {
        if (active) {
          setLoad({
            state: 'error',
            message: 'This scan could not be read from the local database.',
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (load.state === 'loading') {
    return (
      <Screen scroll={false} testID="scan-detail-screen">
        <LoadingState message="Loading scan…" />
      </Screen>
    );
  }

  if (load.state === 'error') {
    return (
      <Screen scroll={false} testID="scan-detail-screen">
        <ErrorState
          title="Scan could not be opened"
          message={load.message}
          onRetry={() => navigation.goBack()}
          retryLabel="Back to history"
        />
      </Screen>
    );
  }

  if (load.state === 'missing') {
    return (
      <Screen scroll={false} testID="scan-detail-screen">
        <ErrorState
          title="Scan not found"
          message="This scan is no longer in the local database. It may have been deleted."
          onRetry={() => navigation.goBack()}
          retryLabel="Back to history"
        />
      </Screen>
    );
  }

  const scan = load.scan;
  const entry = libraryEntry(scan.topClass);

  return (
    <Screen testID="scan-detail-screen">
      <View style={styles.stack}>
        <SavedResultView scan={scan} />

        <Card style={styles.card}>
          <Text variant="heading">What you can do now</Text>
          {entry.culturalControls.map((item) => (
            <Text key={item} tone="muted">
              • {item}
            </Text>
          ))}
          <Text variant="caption" tone="muted">
            {GUIDANCE_SCOPE_NOTE}
          </Text>
        </Card>

        <Button
          label={exportStatus === 'exporting' ? 'Preparing PDF…' : 'Export PDF report'}
          onPress={() => void exportReport(scan)}
          loading={exportStatus === 'exporting'}
          testID="export-report"
        />
        {exportError !== null ? (
          <Text tone="danger" testID="export-error">
            {exportError}
          </Text>
        ) : null}

        <Button
          label="Delete scan"
          variant="danger"
          onPress={() => {
            void remove(scan.id).then(() => navigation.goBack());
          }}
          testID="delete-scan"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.sm },
});
