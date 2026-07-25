import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  Badge,
  Button,
  Card,
  CategoryPill,
  ConfidenceBar,
  EmptyState,
  ErrorState,
  LoadingState,
  Text,
} from './index';
import { renderWithTheme } from '@/test/renderWithTheme';

describe('Text', () => {
  it.each(['light', 'dark'] as const)('renders in the %s theme', async (scheme) => {
    await renderWithTheme(<Text tone="danger">Alert</Text>, scheme);
    expect(screen.getByText('Alert')).toBeTruthy();
  });

  it('throws outside a ThemeProvider', async () => {
    // Silence React's error logging for the expected throw.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Text>orphan</Text>)).rejects.toThrow(/inside a ThemeProvider/);
    spy.mockRestore();
  });
});

describe('Button', () => {
  it('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Scan" onPress={onPress} testID="scan" />);
    fireEvent.press(screen.getByTestId('scan'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Scan" onPress={onPress} disabled testID="scan" />);
    fireEvent.press(screen.getByTestId('scan'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading, and blocks presses', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Scan" onPress={onPress} loading testID="scan" />);
    expect(screen.queryByText('Scan')).toBeNull();
    expect(screen.getByTestId('scan-spinner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('scan'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ConfidenceBar', () => {
  it('renders both labels', async () => {
    await renderWithTheme(
      <ConfidenceBar fraction={0.87} label="Leaf Miner" valueLabel="87%" testID="bar" />,
    );
    expect(screen.getByText('Leaf Miner')).toBeTruthy();
    expect(screen.getByText('87%')).toBeTruthy();
  });

  it('clamps out-of-range fractions', async () => {
    await renderWithTheme(
      <ConfidenceBar fraction={1.7} label="X" valueLabel="170%" testID="bar" />,
    );
    const fill = screen.getByTestId('bar-fill');
    expect(fill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '100%' })]),
    );
  });
});

describe('states', () => {
  it('LoadingState shows its message', async () => {
    await renderWithTheme(<LoadingState message="Analysing leaf…" />);
    expect(screen.getByText('Analysing leaf…')).toBeTruthy();
  });

  it('ErrorState shows a failure-specific message and retries', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(
      <ErrorState
        title="No connection"
        message="Scanning needs the network right now. Check your connection and retry."
        onRetry={onRetry}
      />,
    );
    fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EmptyState renders an optional action', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <EmptyState
        title="No scans yet"
        message="Your saved scans will appear here."
        actionLabel="Scan a leaf"
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByText('Scan a leaf'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('Badge and CategoryPill', () => {
  it('Badge always carries a visible label', async () => {
    await renderWithTheme(<Badge label="Limited data" tone="warning" />);
    expect(screen.getByText('Limited data')).toBeTruthy();
  });

  it('CategoryPill renders its label in both variants', async () => {
    await renderWithTheme(
      <Card>
        <CategoryPill label="Insect Pest" prominent />
        <CategoryPill label="Nutrient Deficiency" />
      </Card>,
    );
    expect(screen.getByText('Insect Pest')).toBeTruthy();
    expect(screen.getByText('Nutrient Deficiency')).toBeTruthy();
  });
});
