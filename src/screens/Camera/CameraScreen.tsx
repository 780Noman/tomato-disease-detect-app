import { useNavigation } from '@react-navigation/native';

import { EmptyState, Screen } from '@/components';

/**
 * Capture lands in Phase 6 (expo-camera, framing overlay, permission
 * handling). Until then this screen says so plainly — it never pretends
 * to capture or fabricates an image (CLAUDE.md §1).
 */
export function CameraScreen() {
  const navigation = useNavigation();

  return (
    <Screen scroll={false} testID="camera-screen">
      <EmptyState
        title="Camera capture is not built yet"
        message="The guided capture flow arrives in Phase 6. Nothing is wired to the camera hardware yet, so there is no photo to take here."
        actionLabel="Back to the guide"
        onAction={() => navigation.goBack()}
      />
    </Screen>
  );
}
