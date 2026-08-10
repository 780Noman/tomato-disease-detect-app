import NetInfo from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';

import { NetworkNotice } from './NetworkNotice';
import { ThemeProvider } from '@/theme';

/**
 * jest.setup.ts installs NetInfo's official mock, which reports a connected
 * state. Offline is simulated by overriding fetch/addEventListener.
 */
function mockConnectivity(isConnected: boolean | null) {
  jest
    .spyOn(NetInfo, 'fetch')
    .mockResolvedValue({ isConnected } as Awaited<ReturnType<typeof NetInfo.fetch>>);
  jest.spyOn(NetInfo, 'addEventListener').mockReturnValue(() => undefined);
}

function renderNotice() {
  return render(
    <ThemeProvider>
      <NetworkNotice />
    </ThemeProvider>,
  );
}

describe('NetworkNotice', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns when offline, naming both what breaks and what still works', async () => {
    mockConnectivity(false);
    await renderNotice();

    expect(await screen.findByTestId('network-notice')).toBeTruthy();
    expect(screen.getByText(/Diagnosis needs an internet connection/)).toBeTruthy();
    // Colour is never the only signal (CLAUDE.md §11).
    expect(screen.getByTestId('network-notice-badge')).toBeTruthy();
    // An offline user must know the app is limited, not broken.
    expect(screen.getByText(/still work offline/)).toBeTruthy();
  });

  it('stays out of the way when online', async () => {
    mockConnectivity(true);
    await renderNotice();
    expect(screen.queryByTestId('network-notice')).toBeNull();
  });

  it('shows nothing while reachability is still unknown', async () => {
    // Claiming "offline" before NetInfo has answered would be a guess, and a
    // banner flashing on a working connection reads as a fault.
    mockConnectivity(null);
    await renderNotice();
    expect(screen.queryByTestId('network-notice')).toBeNull();
  });

  it('treats a later drop in connectivity as offline', async () => {
    // The listener, not just the initial fetch: the user may be on Home when
    // the connection goes.
    let emit: ((state: { isConnected: boolean | null }) => void) | undefined;
    jest
      .spyOn(NetInfo, 'fetch')
      .mockResolvedValue({ isConnected: true } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    jest.spyOn(NetInfo, 'addEventListener').mockImplementation((listener) => {
      emit = listener as (state: { isConnected: boolean | null }) => void;
      return () => undefined;
    });

    await renderNotice();
    expect(screen.queryByTestId('network-notice')).toBeNull();

    await act(async () => {
      emit?.({ isConnected: false });
    });
    expect(screen.getByTestId('network-notice')).toBeTruthy();
  });

  it('makes no accuracy claim (CLAUDE.md §7)', async () => {
    mockConnectivity(false);
    await renderNotice();
    expect(screen.queryByText(/accurate|accuracy|%/i)).toBeNull();
  });
});
