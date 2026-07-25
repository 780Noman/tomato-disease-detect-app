import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Button, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useHistoryStore } from '@/features/history/historyStore';
import { ResultsView } from '@/features/scan/ResultsView';
import { buildScanToSave } from '@/features/scan/saveScan';
import { useInference } from '@/features/scan/useInference';
import type { Classification } from '@/inference';
import { spacing } from '@/theme';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const { imageUri } = route.params;
  const { status, retry } = useInference(imageUri);
  const saveToHistory = useHistoryStore((s) => s.save);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  async function save(result: Classification): Promise<void> {
    setSaveState('saving');
    try {
      const scan = await buildScanToSave(imageUri, result, Date.now());
      const saved = await saveToHistory(scan);
      setSaveState(saved === null ? 'error' : 'saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <Screen testID="results-screen">
      {status.state === 'idle' || status.state === 'loading' ? (
        <LoadingState message="Analysing leaf…" testID="results-loading" />
      ) : null}

      {status.state === 'error' ? (
        <ErrorState
          title="No diagnosis was made"
          message={status.message}
          onRetry={retry}
          testID="results-error"
        />
      ) : null}

      {status.state === 'success' ? (
        <View style={styles.stack}>
          <ResultsView imageUri={imageUri} result={status.result} />
          <Button
            label={
              saveState === 'saved'
                ? 'Saved to history'
                : saveState === 'saving'
                  ? 'Saving…'
                  : 'Save to history'
            }
            onPress={() => void save(status.result)}
            loading={saveState === 'saving'}
            disabled={saveState === 'saved'}
            testID="save-scan"
          />
          {saveState === 'error' ? (
            <Text tone="danger" testID="save-error">
              This scan could not be saved to the local database. The diagnosis above is still
              valid.
            </Text>
          ) : null}
          <Button
            label="Scan another leaf"
            variant="secondary"
            onPress={() => navigation.navigate('CaptureGuide')}
            testID="scan-again"
          />
          <Button label="Home" variant="ghost" onPress={() => navigation.navigate('Home')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
