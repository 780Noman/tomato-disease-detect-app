import Svg, { Path, Use } from 'react-native-svg';

import { useTheme } from '@/theme';

interface LogoProps {
  readonly size?: number;
  /** Overrides the themed colour (e.g. onPrimary contexts). */
  readonly color?: string;
  readonly testID?: string;
}

/**
 * The brand mark, inlined from assets/logo.svg so it can take the theme
 * colour. If assets/logo.svg changes, update these paths to match.
 */
export function Logo({ size = 48, color, testID }: LogoProps) {
  const theme = useTheme();
  const stroke = color ?? theme.color.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none" testID={testID}>
      <Path
        d="M104 40 L68 40 Q40 40 40 68 L40 104 M408 40 L444 40 Q472 40 472 68 L472 104 M104 472 L68 472 Q40 472 40 444 L40 408 M408 472 L444 472 Q472 472 472 444 L472 408"
        stroke={stroke}
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        id="leaf-half"
        d="M256 380 C230 372 196 356 178 330 L192 322 C176 302 168 282 170 262 L186 258 C172 236 170 216 178 198 L194 200 C186 180 196 156 216 146 L222 158 C232 144 246 130 256 122"
        stroke={stroke}
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Use
        href="#leaf-half"
        transform="translate(512 0) scale(-1 1)"
        stroke={stroke}
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M256 380 L256 414" stroke={stroke} strokeWidth={26} strokeLinecap="round" />
      <Path d="M256 356 L256 168" stroke={stroke} strokeWidth={20} strokeLinecap="round" />
    </Svg>
  );
}
