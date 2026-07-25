import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { radii, spacing } from '@/theme';

interface PhotoFrameProps {
  readonly source: ImageSourcePropType;
  readonly accessibilityLabel: string;
  readonly testID?: string;
  /** Total horizontal padding around the frame. Defaults to a padded Screen. */
  readonly horizontalInset?: number;
}

/**
 * A square image that always shows the WHOLE image, letterboxed.
 *
 * Sizing is an explicit pixel number derived from the window width, on both
 * the wrapper and the Image. This is deliberate: `width: '100%'` and
 * `aspectRatio` on an Image can fail to resolve under the new React Native
 * architecture (newArchEnabled), leaving the image at its intrinsic size —
 * an 800px asset then overflows and the frame crops it to a corner. A number
 * has nothing to resolve, so it cannot fail that way.
 */
export function PhotoFrame({
  source,
  accessibilityLabel,
  testID,
  horizontalInset = spacing.md * 2,
}: PhotoFrameProps) {
  const { width } = useWindowDimensions();
  const size = Math.max(120, Math.round(width - horizontalInset));

  return (
    <View style={[styles.frame, { width: size, height: size }]} testID={testID}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#201914',
  },
});
