import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { hairline, radii, shadow, spacing, useTheme } from '@/theme';

interface CardProps {
  readonly children: ReactNode;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export function Card({ children, style, testID }: CardProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: theme.color.surfaceRaised,
          borderColor: theme.color.border,
          borderWidth: hairline,
          borderRadius: radii.lg,
          padding: spacing.md,
        },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
