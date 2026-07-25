import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { Button, Text } from '@/components';
import { renderWithTheme } from '@/test/renderWithTheme';

function Bomb({ defused }: { defused: boolean }) {
  if (!defused) {
    throw new Error('deliberate test crash');
  }
  return <Text>content recovered</Text>;
}

function Harness() {
  const [defused, setDefused] = useState(false);
  return (
    <>
      <Button label="defuse" onPress={() => setDefused(true)} testID="defuse" />
      <ErrorBoundary>
        <Bomb defused={defused} />
      </ErrorBoundary>
    </>
  );
}

describe('ErrorBoundary', () => {
  it('catches a render crash, shows the message, and recovers on reset', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderWithTheme(<Harness />);

    // Dev builds surface the real message.
    expect(screen.getByText('The app hit a problem')).toBeTruthy();
    expect(screen.getByText('deliberate test crash')).toBeTruthy();

    // Fix the child, then reset the boundary.
    fireEvent.press(screen.getByTestId('defuse'));
    fireEvent.press(screen.getByText('Recover'));
    expect(await screen.findByText('content recovered')).toBeTruthy();
    spy.mockRestore();
  });
});
