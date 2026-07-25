import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Image, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '@/app/navigation/types';
import { Button, Screen, Text } from '@/components';
import { radii, spacing } from '@/theme';

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
        <Image
          source={{ uri: imageUri }}
          style={styles.preview}
          resizeMode="cover"
          accessibilityLabel="The photo you just took"
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
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: '#201914',
  },
});
