import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { typography, useTheme, type Theme, type TypographyVariant } from '@/theme';

export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onPrimary'
  | 'onPrimaryTint'
  | 'onDanger';

interface TextProps extends RNTextProps {
  readonly variant?: TypographyVariant;
  readonly tone?: TextTone;
}

function colorForTone(theme: Theme, tone: TextTone): string {
  switch (tone) {
    case 'default':
      return theme.color.text;
    case 'muted':
      return theme.color.textMuted;
    case 'primary':
      return theme.color.primary;
    case 'accent':
      return theme.color.accentText;
    case 'success':
      return theme.color.success;
    case 'warning':
      return theme.color.warningText;
    case 'danger':
      return theme.color.danger;
    case 'onPrimary':
      return theme.color.onPrimary;
    case 'onPrimaryTint':
      return theme.color.onPrimaryTint;
    case 'onDanger':
      return theme.color.onDanger;
    default: {
      const unreachable: never = tone;
      return unreachable;
    }
  }
}

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const theme = useTheme();
  const base: TextStyle = {
    ...typography[variant],
    color: colorForTone(theme, tone),
  };
  return <RNText {...rest} style={[base, style]} />;
}
