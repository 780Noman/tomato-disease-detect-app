import { render, screen } from '@testing-library/react-native';

import App from './App';

// App owns its SafeAreaProvider; in Jest there is no native layout event, so
// use the library's official mock to render synchronously.
jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

describe('App', () => {
  it('renders the dev component gallery (__DEV__ is true under Jest)', async () => {
    await render(<App />);
    expect(screen.getByText('Component Gallery')).toBeTruthy();
  });
});
