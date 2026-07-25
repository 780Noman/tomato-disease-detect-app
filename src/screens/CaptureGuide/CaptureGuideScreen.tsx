import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import { radii, spacing } from '@/theme';

const STEPS = [
  'Detach one leaf from the plant.',
  'Lay it flat on a dark surface — dark cloth, slate or soil-free board.',
  'Hold the phone directly above, pointing straight down.',
  'Fill the frame with the leaf, in even light without harsh shadows.',
] as const;

export function CaptureGuideScreen() {
  const navigation = useNavigation();
  const [showWhy, setShowWhy] = useState(false);

  return (
    <Screen testID="capture-guide-screen">
      <View style={styles.stack}>
        <Text variant="title">How to photograph the leaf</Text>

        <Image
          source={require('../../../assets/capture-reference.png')}
          style={styles.reference}
          resizeMode="contain"
          accessibilityLabel="Illustration of a single detached leaf laid flat on a dark surface, framed from directly above"
        />
        <Text variant="caption" tone="muted" style={styles.center}>
          Illustration of a correctly staged leaf.
        </Text>

        <Card style={styles.steps}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <Text variant="label" tone="primary">
                {index + 1}
              </Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>

        <Button
          label="Why does this matter?"
          variant="ghost"
          onPress={() => setShowWhy(!showWhy)}
          testID="toggle-why"
        />
        {showWhy ? (
          <Card>
            <Text>
              The model learned only from photos staged exactly like this — one detached leaf on a
              dark background. A photo of a leaf still on the plant will produce a confident-looking
              answer that means nothing.
            </Text>
          </Card>
        ) : null}

        <Button
          label="Open camera"
          onPress={() => navigation.navigate('Camera')}
          testID="go-camera"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  reference: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
  },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { flex: 1 },
  center: { textAlign: 'center' },
});
