import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { NETWORK_NOTICE_STORAGE_KEY, useNetworkNotice } from './useNetworkNotice';

// jest.setup.ts seeds the "already seen" flag so screen tests are not blocked
// by the modal. These tests are about the flag itself, so they control it.
function Probe() {
  const { visible, dismiss } = useNetworkNotice();
  return (
    <View>
      <Text testID="state">{visible === null ? 'loading' : visible ? 'visible' : 'hidden'}</Text>
      <Text testID="dismiss" onPress={dismiss}>
        dismiss
      </Text>
    </View>
  );
}

describe('useNetworkNotice', () => {
  it('shows the notice on a fresh install', async () => {
    await AsyncStorage.removeItem(NETWORK_NOTICE_STORAGE_KEY);
    await render(<Probe />);
    expect(await screen.findByText('visible')).toBeTruthy();
  });

  it('stays hidden once it has been seen', async () => {
    await AsyncStorage.setItem(NETWORK_NOTICE_STORAGE_KEY, 'true');
    await render(<Probe />);
    expect(await screen.findByText('hidden')).toBeTruthy();
  });

  it('remembers the dismissal, so it never shows twice', async () => {
    await AsyncStorage.removeItem(NETWORK_NOTICE_STORAGE_KEY);
    await render(<Probe />);
    expect(await screen.findByText('visible')).toBeTruthy();

    await userEvent.press(screen.getByTestId('dismiss'));
    expect(screen.getByText('hidden')).toBeTruthy();

    // The write is fire-and-forget behind a dynamic import, so poll for it
    // rather than assuming a fixed number of microtasks.
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(NETWORK_NOTICE_STORAGE_KEY)).toBe('true');
    });
  });

  it('errs towards showing the notice when storage cannot be read', async () => {
    // A first-time user with no explanation is the worse failure, so an
    // unreadable flag must not silently suppress the notice.
    const getItem = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('storage unavailable'));
    await render(<Probe />);
    expect(await screen.findByText('visible')).toBeTruthy();
    getItem.mockRestore();
  });
});
