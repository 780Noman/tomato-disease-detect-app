import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ResultsScreen } from './ResultsScreen';
import type { RootStackParamList } from '@/app/navigation/types';
import { Text } from '@/components';
import { resetInferenceProvider } from '@/inference';
import { renderWithTheme } from '@/test/renderWithTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function StubScreen() {
  return <Text>stub</Text>;
}

function renderResults(imageUri: string) {
  return renderWithTheme(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Results" component={ResultsScreen} initialParams={{ imageUri }} />
        <Stack.Screen name="CaptureGuide" component={StubScreen} />
        <Stack.Screen name="Home" component={StubScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

describe('ResultsScreen', () => {
  afterEach(() => {
    resetInferenceProvider();
  });

  it('settles on a full result with no lingering loading state (mock provider)', async () => {
    await renderResults('file:///photos/leaf-1.jpg');

    // The deterministic mock resolves within render's act cycle, so the
    // loading frame is not reliably observable — assert the settled state.
    await waitFor(() => expect(screen.getByTestId('results-view')).toBeTruthy());
    expect(screen.queryByTestId('results-loading')).toBeNull();
    expect(screen.getByTestId('no-healthy-note')).toBeTruthy();
    expect(screen.getByTestId('scan-again')).toBeTruthy();
  });

  it('shows the failure-specific error state with retry on inference failure', async () => {
    await renderResults('mock://error/image-unreadable');

    await waitFor(() => expect(screen.getByTestId('results-error')).toBeTruthy());
    expect(screen.getByText(/could not be read/)).toBeTruthy();
    expect(screen.getByText('No diagnosis was made')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('retry re-runs inference', async () => {
    await renderResults('mock://error/no-network');
    await waitFor(() => expect(screen.getByTestId('results-error')).toBeTruthy());

    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByTestId('results-error')).toBeTruthy());
  });
});
