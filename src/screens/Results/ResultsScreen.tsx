import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Button, ErrorState, LoadingState, Screen } from '@/components';
import { ResultsView } from '@/features/scan/ResultsView';
import { useInference } from '@/features/scan/useInference';
import { spacing } from '@/theme';

export function ResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const { imageUri } = route.params;
  const { status, retry } = useInference(imageUri);

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
