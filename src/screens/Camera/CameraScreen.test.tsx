import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { CameraScreen } from './CameraScreen';
import type { RootStackParamList } from '@/app/navigation/types';
import { Text } from '@/components';
import { renderWithTheme } from '@/test/renderWithTheme';

const mockUseCameraPermissions = jest.fn();
jest.mock('expo-camera', () => ({
  CameraView: jest.requireActual<{ View: unknown }>('react-native').View,
  useCameraPermissions: (...args: unknown[]) =>
    (mockUseCameraPermissions as (...a: unknown[]) => unknown)(...args),
}));

const Stack = createNativeStackNavigator<RootStackParamList>();

function StubScreen() {
  return <Text>stub</Text>;
}

function renderCamera() {
  return renderWithTheme(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="ConfirmPhoto" component={StubScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

describe('CameraScreen permission paths (CLAUDE.md §9)', () => {
  it.each([
    ['null', null],
    // The hook yields undefined before it resolves; reading .granted off it
    // used to crash the screen into the error boundary.
    ['undefined', undefined],
  ])('shows a loading state while the permission is %s', async (_label, value) => {
    mockUseCameraPermissions.mockReturnValue([value, jest.fn()]);
    await renderCamera();
    expect(screen.getByText('Checking camera permission…')).toBeTruthy();
  });

  it('not yet asked: shows the rationale and requests on tap', async () => {
    const request = jest.fn();
    mockUseCameraPermissions.mockReturnValue([{ granted: false, canAskAgain: true }, request]);
    await renderCamera();

    expect(screen.getByText('Camera permission needed')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-permission'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('permanently blocked: offers the system-settings deep link', async () => {
    mockUseCameraPermissions.mockReturnValue([{ granted: false, canAskAgain: false }, jest.fn()]);
    await renderCamera();

    expect(screen.getByText('Camera access is blocked')).toBeTruthy();
    expect(screen.getByText('Open settings')).toBeTruthy();
  });

  it('granted: shows the framing overlay, protocol hint and shutter', async () => {
    mockUseCameraPermissions.mockReturnValue([{ granted: true, canAskAgain: true }, jest.fn()]);
    await renderCamera();

    expect(screen.getByTestId('framing-overlay')).toBeTruthy();
    expect(screen.getByText(/fill the brackets/)).toBeTruthy();
    expect(screen.getByTestId('shutter')).toBeTruthy();
  });

  it('surfaces a capture failure as an explicit error state with recovery', async () => {
    mockUseCameraPermissions.mockReturnValue([{ granted: true, canAskAgain: true }, jest.fn()]);
    await renderCamera();

    // The mocked CameraView has no takePictureAsync, so capture fails.
    fireEvent.press(screen.getByTestId('shutter'));
    expect(await screen.findByText('Could not take the photo')).toBeTruthy();
    fireEvent.press(screen.getByText('Back to camera'));
    expect(await screen.findByTestId('shutter')).toBeTruthy();
  });
});

// Referenced to satisfy no-unused-vars for the mock import shape.
void View;
