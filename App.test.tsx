import { fireEvent, render, screen } from '@testing-library/react-native';

import App from './App';

// App owns its SafeAreaProvider; in Jest there is no native layout event, so
// use the library's official mock to render synchronously.
jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

describe('App', () => {
  it('boots to the Home screen', async () => {
    await render(<App />);
    expect(screen.getByText('Tomato Leaf Doctor')).toBeTruthy();
    expect(screen.getByTestId('go-capture-guide')).toBeTruthy();
  });

  it('navigates Home → capture guide → camera pending screen', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-capture-guide'));
    expect(await screen.findByText('How to photograph the leaf')).toBeTruthy();

    fireEvent.press(screen.getByTestId('go-camera'));
    expect(await screen.findByText('Camera capture is not built yet')).toBeTruthy();
  });

  it('reaches settings and switches the theme preference', async () => {
    await render(<App />);
    fireEvent.press(screen.getByTestId('go-settings'));
    expect(await screen.findByText('Appearance')).toBeTruthy();

    fireEvent.press(screen.getByTestId('theme-dark'));
    expect(await screen.findByText('Current: Dark')).toBeTruthy();
  });
});
