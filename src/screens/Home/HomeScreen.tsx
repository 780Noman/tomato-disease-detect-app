import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Logo, Screen, Text } from '@/components';
import { NetworkNotice, NetworkRequiredModal, useNetworkNotice } from '@/features/connectivity';
import { spacing } from '@/theme';

export function HomeScreen() {
  const navigation = useNavigation();
  const notice = useNetworkNotice();

  return (
    <Screen testID="home-screen">
      <NetworkRequiredModal visible={notice.visible === true} onDismiss={notice.dismiss} />
      <View style={styles.stack}>
        <View style={styles.hero}>
          <Logo size={88} />
          <Text variant="title">Tomato Leaf Doctor</Text>
          <Text tone="muted" style={styles.center}>
            Diagnose tomato leaf pests and nutrient deficiencies from a photo of a single detached
            leaf.
          </Text>
        </View>

        <NetworkNotice />

        <Card style={styles.card}>
          <Text variant="heading">Scan a leaf</Text>
          <Text tone="muted">
            The capture guide shows how to stage the leaf so the diagnosis is meaningful.
          </Text>
          {/* Stated permanently, not only when offline: someone planning a trip
              to a field needs to know before they get there. */}
          <Text variant="caption" tone="muted" testID="home-network-requirement">
            Scanning needs an internet connection. History, the library and reports work offline.
          </Text>
          <Button
            label="Start capture guide"
            onPress={() => navigation.navigate('CaptureGuide')}
            testID="go-capture-guide"
          />
        </Card>

        <Card style={styles.card}>
          <Text variant="heading">Your scans</Text>
          <Button
            label="History"
            variant="secondary"
            onPress={() => navigation.navigate('History')}
            testID="go-history"
          />
          <Button
            label="Disease library"
            variant="secondary"
            onPress={() => navigation.navigate('Library')}
            testID="go-library"
          />
          <Button
            label="Settings"
            variant="ghost"
            onPress={() => navigation.navigate('Settings')}
            testID="go-settings"
          />
        </Card>

        <Text variant="caption" tone="muted" style={styles.center}>
          The model distinguishes six pest and deficiency conditions. It does not detect healthy
          leaves.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  card: { gap: spacing.md },
  center: { textAlign: 'center' },
});
