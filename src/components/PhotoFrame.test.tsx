import { screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { PhotoFrame } from './PhotoFrame';
import { spacing } from '@/theme';
import { renderWithTheme } from '@/test/renderWithTheme';

const WINDOW_WIDTH = Dimensions.get('window').width;

/**
 * Regression guard. Images were being clipped to a corner on device because
 * `width: '100%'` / `aspectRatio` on an Image can fail to resolve under the
 * new RN architecture, leaving the asset at its intrinsic size. The frame must
 * therefore size both itself and the image with plain numbers, and letterbox
 * with `contain` so nothing is ever cropped away.
 */
function imageStyle(): Record<string, unknown> {
  const image = screen.getByLabelText('test image');
  const style = image.props.style as Record<string, unknown> | Record<string, unknown>[];
  return Array.isArray(style) ? Object.assign({}, ...style) : style;
}

describe('PhotoFrame', () => {
  const source = { uri: 'file:///photos/leaf.jpg' };

  it('sizes the image with numbers, never a percentage or aspectRatio', async () => {
    await renderWithTheme(<PhotoFrame source={source} accessibilityLabel="test image" />);
    const style = imageStyle();

    expect(typeof style.width).toBe('number');
    expect(typeof style.height).toBe('number');
    expect(style.width).not.toBe('100%');
    expect(style.aspectRatio).toBeUndefined();
  });

  it('renders a square so the letterboxing is symmetric', async () => {
    await renderWithTheme(<PhotoFrame source={source} accessibilityLabel="test image" />);
    const style = imageStyle();
    expect(style.width).toBe(style.height);
  });

  it('uses contain, so the whole image is always visible', async () => {
    await renderWithTheme(<PhotoFrame source={source} accessibilityLabel="test image" />);
    expect(screen.getByLabelText('test image').props.resizeMode).toBe('contain');
  });

  it('fits inside the window, accounting for screen padding', async () => {
    await renderWithTheme(<PhotoFrame source={source} accessibilityLabel="test image" />);
    // Exactly the window minus the padded Screen's left+right padding.
    expect(imageStyle().width).toBe(WINDOW_WIDTH - spacing.md * 2);
  });

  it('honours a custom inset', async () => {
    await renderWithTheme(
      <PhotoFrame source={source} accessibilityLabel="test image" horizontalInset={100} />,
    );
    expect(imageStyle().width).toBe(WINDOW_WIDTH - 100);
  });

  it('never collapses to an unusably small size', async () => {
    await renderWithTheme(
      <PhotoFrame source={source} accessibilityLabel="test image" horizontalInset={10_000} />,
    );
    expect(imageStyle().width).toBe(120);
  });
});
