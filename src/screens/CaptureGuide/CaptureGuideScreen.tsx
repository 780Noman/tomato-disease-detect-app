import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, PhotoFrame, Screen, Text } from '@/components';
import { spacing } from '@/theme';

const STEPS = [
  'Detach one leaf from the plant.',
  'Lay it flat on a dark surface — dark cloth, slate or soil-free board.',
  'Hold the phone directly above, pointing straight down.',
  'Fill the frame with the leaf, in even light without harsh shadows.',
] as const;

export function CaptureGuideScreen() {
  const navigation = useNavigation();
  const [pickerError, setPickerError] = useState<string | null>(null);

  async function pickFromGallery(): Promise<void> {
    setPickerError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset !== undefined) {
        navigation.navigate('ConfirmPhoto', { imageUri: asset.uri });
      }
    } catch {
      setPickerError('The photo library could not be opened. Check the photos permission.');
    }
  }

  return (
    <Screen testID="capture-guide-screen">
      <View style={styles.stack}>
        <Text variant="title">How to photograph the leaf</Text>

        <PhotoFrame
          source={require('../../../assets/capture-reference.png')}
          accessibilityLabel="Illustration of a single detached leaf laid flat on a dark surface, framed from directly above"
          testID="capture-reference"
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
          label="Open camera"
          onPress={() => navigation.navigate('Camera')}
          testID="go-camera"
        />
        <Button
          label="Choose an existing photo"
          variant="secondary"
          onPress={() => void pickFromGallery()}
          testID="pick-gallery"
        />
        {pickerError !== null ? (
          <Text tone="danger" style={styles.center} testID="picker-error">
            {pickerError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { flex: 1 },
  center: { textAlign: 'center' },
});
