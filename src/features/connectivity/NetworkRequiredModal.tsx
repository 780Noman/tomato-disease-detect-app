import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components';
import { radii, spacing, useTheme } from '@/theme';

interface NetworkRequiredModalProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly testID?: string;
}

/**
 * The one-time "how this app works" notice. Presentational: whether it shows at
 * all is decided by useNetworkNotice.
 *
 * It states the limitation before the user hits it, and says what still works
 * offline so the constraint reads as a design fact rather than a fault. No
 * accuracy claim and no reassurance about correctness — see CLAUDE.md section 7.
 */
export function NetworkRequiredModal({
  visible,
  onDismiss,
  testID = 'network-required-modal',
}: NetworkRequiredModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android hardware back must dismiss it, or the notice becomes a trap.
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: theme.color.backdrop }]}>
        <Card style={styles.card} testID={testID}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="heading">Before you start</Text>

            <Text>
              Diagnosis runs on a server, so <Text>an internet connection is required</Text> to scan
              a leaf. Without one, the scan cannot be completed.
            </Text>

            <Text tone="muted">
              These work with no connection at all: your saved scan history, the disease library,
              and exporting a PDF report.
            </Text>

            <Text variant="caption" tone="muted">
              The first scan after the app has been idle for a while can take up to a minute — the
              server has to start up before it can answer.
            </Text>

            <Button label="Got it" onPress={onDismiss} testID="network-required-dismiss" />
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radii.lg, maxHeight: '80%' },
  content: { gap: spacing.md },
});
