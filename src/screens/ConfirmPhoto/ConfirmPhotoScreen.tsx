import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Button, PhotoFrame, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/**
 * The confirm/retake step (CLAUDE.md §5): the user checks the staging —
 * one leaf, dark background, frame filled — before analysis runs.
 */
export function ConfirmPhotoScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ConfirmPhoto'>>();
  const { imageUri } = route.params;

  return (
    <Screen testID="confirm-photo-screen">
      <View style={styles.stack}>
        {/*
          The whole photo, uncropped: this screen exists so the user can check
          the framing before analysis, and cropping would hide exactly the
          edges they are being asked to judge.
        */}
        <PhotoFrame
          source={{ uri: imageUri }}
          accessibilityLabel="The photo you just took"
          testID="photo-preview"
        />
        <Text variant="heading">Check the photo</Text>
        <Text tone="muted">
          One detached leaf, dark background, leaf filling the frame, no harsh shadows. If not,
          retake — the diagnosis is only meaningful for a photo staged like the guide.
        </Text>
        <Button
          label="Analyse this leaf"
          onPress={() => navigation.navigate('Results', { imageUri })}
          testID="analyse"
        />
        <Button
          label="Retake"
          variant="secondary"
          onPress={() => navigation.goBack()}
          testID="retake"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
