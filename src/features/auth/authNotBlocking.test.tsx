import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../../../App';
import { useAuthStore } from './authStore';
import { InMemoryScanRepository } from '@/features/history/InMemoryScanRepository';
import { setScanRepository } from '@/features/history/repository';

jest.mock('@/features/history/scanImage', () => ({
  persistScanImage: jest.fn().mockResolvedValue('file:///scans/copy.jpg'),
  deleteScanImage: jest.fn().mockResolvedValue(undefined),
}));

/**
 * THE PHASE 9 CONTRACT (review §3): a user with no account and no network
 * must still be able to scan, get a diagnosis and use history. This test
 * drives the real app with a signed-out store and no Firebase config.
 */
describe('auth is never on the critical path to a diagnosis', () => {
  beforeEach(() => {
    setScanRepository(new InMemoryScanRepository());
    useAuthStore.setState({ status: 'signed-out', account: null, error: null, skipped: false });
  });

  afterAll(() => {
    setScanRepository(null);
  });

  it('boots straight to Home with no sign-in wall', async () => {
    await render(<App />);
    expect(screen.getByTestId('go-capture-guide')).toBeTruthy();
    expect(screen.queryByTestId('auth-screen')).toBeNull();
  });

  it('reaches a full diagnosis while signed out', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-capture-guide'));
    expect(await screen.findByText('How to photograph the leaf')).toBeTruthy();

    // Camera hardware is unavailable in tests; the gallery path proves the
    // same thing — no auth check stands between a photo and a diagnosis.
    expect(screen.getByTestId('pick-gallery')).toBeTruthy();
  });

  it('opens history while signed out', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-history'));
    await waitFor(() => expect(screen.getByTestId('history-screen')).toBeTruthy());
  });

  it('opens the disease library while signed out and offline', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-library'));
    expect(await screen.findByText('Leaf Miner')).toBeTruthy();
  });

  it('offers "continue without an account" on the optional account screen', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-settings'));
    fireEvent.press(await screen.findByTestId('go-auth'));

    expect(await screen.findByTestId('skip-auth')).toBeTruthy();
    expect(screen.getByText('An account is optional')).toBeTruthy();
    // No Firebase config in tests, so the screen says so plainly.
    expect(screen.getByTestId('auth-unconfigured')).toBeTruthy();
  });
});
