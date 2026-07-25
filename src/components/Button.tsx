import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Text, type TextTone } from './Text';
import { minTouchTarget, radii, spacing, useTheme, type Theme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly testID?: string;
}

interface VariantStyle {
  readonly container: ViewStyle;
  readonly pressed: ViewStyle;
  readonly tone: TextTone;
  readonly spinner: string;
}

function variantStyle(theme: Theme, variant: ButtonVariant): VariantStyle {
  const c = theme.color;
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: c.primary },
        pressed: { backgroundColor: c.primaryPressed },
        tone: 'onPrimary',
        spinner: c.onPrimary,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: c.surfaceRaised,
          borderWidth: 1,
          borderColor: c.primary,
        },
        pressed: { backgroundColor: c.primaryTint },
        tone: 'primary',
        spinner: c.primary,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        pressed: { backgroundColor: c.primaryTint },
        tone: 'primary',
        spinner: c.primary,
      };
    case 'danger':
      return {
        container: { backgroundColor: c.danger },
        pressed: { backgroundColor: c.danger, opacity: 0.85 },
        tone: 'onDanger',
        spinner: c.onDanger,
      };
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const v = variantStyle(theme, variant);
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      testID={testID}
      onPress={() => {
        if (!blocked) onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        v.container,
        pressed && !blocked ? v.pressed : null,
        blocked ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <Text variant="label" tone={v.tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: { opacity: 0.5 },
});
