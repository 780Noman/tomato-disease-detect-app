import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, ErrorState, FramingOverlay, LoadingState, Screen, Text } from '@/components';
import { env } from '@/config/env';
import { useNetworkStatus } from '@/features/connectivity/useNetworkStatus';
import { spacing } from '@/theme';

/**
 * Guided capture (CLAUDE.md §5). Three explicit permission paths:
 * not yet asked → rationale + ask; denied but askable → ask again;
 * permanently blocked → deep-link to system settings.
 */
export function CameraScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const { online } = useNetworkStatus();
  // Only the remote path needs the network; on-device inference does not.
  const needsNetwork = env.inferenceProvider === 'remote' && online === false;

  // Permission state not yet known. expo-camera types this as
  // `PermissionResponse | null`, but the hook yields `undefined` before it
  // resolves (observed under test, and reachable on a device if the native
  // module is slow), so both are treated as "unknown" — reading `.granted`
  // off undefined would crash the screen into the error boundary.
  const permissionState: typeof permission | undefined = permission;
  if (permissionState === null || permissionState === undefined) {
    return (
      <Screen scroll={false} testID="camera-screen">
        <LoadingState message="Checking camera permission…" />
      </Screen>
    );
  }

  if (!permissionState.granted) {
    if (permissionState.canAskAgain) {
      return (
        <Screen scroll={false} testID="camera-screen">
          <View style={styles.permission}>
            <Text variant="heading" style={styles.center}>
              Camera permission needed
            </Text>
            <Text tone="muted" style={styles.center}>
              The camera photographs one detached leaf on a dark surface. Photos are analysed on
              this device.
            </Text>
            <Button
              label="Allow camera"
              onPress={() => void requestPermission()}
              testID="ask-permission"
            />
          </View>
        </Screen>
      );
    }
    return (
      <Screen scroll={false} testID="camera-screen">
        <ErrorState
          title="Camera access is blocked"
          message="Camera permission was permanently denied. Enable it in system settings to scan a leaf."
          onRetry={() => void Linking.openSettings()}
          retryLabel="Open settings"
          testID="permission-blocked"
        />
      </Screen>
    );
  }

  if (captureError !== null) {
    return (
      <Screen scroll={false} testID="camera-screen">
        <ErrorState
          title="Could not take the photo"
          message={captureError}
          onRetry={() => setCaptureError(null)}
          retryLabel="Back to camera"
        />
      </Screen>
    );
  }

  async function capture(): Promise<void> {
    const camera = cameraRef.current;
    if (camera === null || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 1 });
      navigation.navigate('ConfirmPhoto', { imageUri: photo.uri });
    } catch {
      setCaptureError('The camera did not return a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Screen scroll={false} padded={false} testID="camera-screen">
      <View style={styles.cameraBox}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <FramingOverlay />
        <View style={styles.hint}>
          <Text variant="caption" style={styles.hintText}>
            One detached leaf, dark surface, shot from directly above — fill the brackets.
          </Text>
        </View>
      </View>
      <View style={styles.controls}>
        {needsNetwork ? (
          <Text variant="caption" tone="danger" style={styles.center} testID="offline-warning">
            This build sends photos to a diagnosis server and there is no connection right now. You
            can still take the photo and retry the diagnosis later.
          </Text>
        ) : null}
        <Button
          label={capturing ? 'Capturing…' : 'Take photo'}
          onPress={() => void capture()}
          loading={capturing}
          testID="shutter"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: { flex: 1, overflow: 'hidden' },
  hint: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(32, 25, 20, 0.72)',
    borderRadius: 8,
    padding: spacing.sm,
  },
  hintText: { color: '#F0E9E2', textAlign: 'center' },
  controls: { padding: spacing.md },
  permission: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
