import { useNavigation } from '@react-navigation/native';

import { EmptyState, Screen } from '@/components';

/**
 * The scan repository (SQLite) lands in Phase 8. No scans can exist before
 * the capture flow works, so the empty state is currently always accurate.
 */
export function HistoryScreen() {
  const navigation = useNavigation();

  return (
    <Screen scroll={false} testID="history-screen">
      <EmptyState
        title="No scans yet"
        message="Scans you save will appear here and stay available offline. Scan storage arrives in Phase 8."
        actionLabel="Scan a leaf"
        onAction={() => navigation.navigate('CaptureGuide')}
      />
    </Screen>
  );
}
