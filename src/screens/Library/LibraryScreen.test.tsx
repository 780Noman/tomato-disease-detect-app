import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';

import { LibraryScreen } from './LibraryScreen';
import { DiseaseDetailScreen } from '../DiseaseDetail/DiseaseDetailScreen';
import type { RootStackParamList } from '@/app/navigation/types';
import { renderWithTheme } from '@/test/renderWithTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function renderLibrary() {
  return renderWithTheme(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="DiseaseDetail" component={DiseaseDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

describe('Library (offline reference)', () => {
  it('lists all six conditions and states that healthy is not among them', async () => {
    await renderLibrary();
    expect(screen.getByText('Leaf Miner')).toBeTruthy();
    expect(screen.getByText('Mite')).toBeTruthy();
    expect(screen.getByText('Jassid + Mite (co-infestation)')).toBeTruthy();
    expect(screen.getByText('Nitrogen Deficiency')).toBeTruthy();
    expect(screen.getByText('Potassium Deficiency')).toBeTruthy();
    expect(screen.getByText('Nitrogen + Potassium Deficiency')).toBeTruthy();
    expect(screen.getByText(/Healthy leaves are not among them/)).toBeTruthy();
  });

  it('opens a condition with symptoms, actions and the scope note', async () => {
    await renderLibrary();
    fireEvent.press(screen.getByTestId('library-tomato__LM'));

    expect(await screen.findByText('Symptoms')).toBeTruthy();
    expect(screen.getByText('What you can do now')).toBeTruthy();
    expect(screen.getByText(/pending review by a local agronomist/)).toBeTruthy();
    expect(screen.getByText('Easily confused with')).toBeTruthy();
  });

  it('shows the limited-data caveat on a weakly-supported condition', async () => {
    await renderLibrary();
    fireEvent.press(screen.getByTestId('library-tomato__JAS_MIT'));
    expect(await screen.findByTestId('library-limited-data')).toBeTruthy();
  });

  it('omits the caveat on a well-supported condition', async () => {
    await renderLibrary();
    fireEvent.press(screen.getByTestId('library-tomato__MIT'));
    await screen.findByText('Symptoms');
    expect(screen.queryByTestId('library-limited-data')).toBeNull();
  });
});
