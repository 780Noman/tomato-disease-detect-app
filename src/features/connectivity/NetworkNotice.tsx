import { StyleSheet, View } from 'react-native';

import { useNetworkStatus } from './useNetworkStatus';
import { Badge, Card, Text } from '@/components';
import { spacing } from '@/theme';

/**
 * Live offline banner. Renders nothing while online, or while reachability is
 * still unknown — a banner that appears on a working connection is noise, and
 * claiming "offline" before NetInfo has answered would be a guess.
 *
 * Presentational only: reachability comes from the hook, and the wording states
 * both what stops working and what does not, so an offline user knows the app
 * is limited rather than broken.
 */
export function NetworkNotice({ testID = 'network-notice' }: { readonly testID?: string }) {
  const { online } = useNetworkStatus();

  if (online !== false) return null;

  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.header}>
        {/* A label, not just a colour — colour is never the only signal. */}
        <Badge label="Offline" tone="warning" testID="network-notice-badge" />
      </View>
      <Text variant="heading">Diagnosis needs an internet connection</Text>
      <Text tone="muted">
        The leaf is analysed on a server, so a scan cannot be completed while you are offline.
        Connect to mobile data or Wi-Fi and try again.
      </Text>
      <Text variant="caption" tone="muted">
        Your saved scans, the disease library and exported reports all still work offline.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row' },
});
