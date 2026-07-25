import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { screen, waitFor } from '@testing-library/react-native';

import { HistoryScreen } from './HistoryScreen';
import type { RootStackParamList } from '@/app/navigation/types';
import { Text } from '@/components';
import { useHistoryStore } from '@/features/history/historyStore';
import { InMemoryScanRepository } from '@/features/history/InMemoryScanRepository';
import { setScanRepository } from '@/features/history/repository';
import type { NewScan } from '@/features/history/types';
import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('@/features/history/scanImage', () => ({
  persistScanImage: jest.fn().mockResolvedValue('file:///scans/copy.jpg'),
  deleteScanImage: jest.fn().mockResolvedValue(undefined),
}));

const Stack = createNativeStackNavigator<RootStackParamList>();

function StubScreen() {
  return <Text>stub</Text>;
}

function renderHistory() {
  return renderWithTheme(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="ScanDetail" component={StubScreen} />
        <Stack.Screen name="CaptureGuide" component={StubScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

const SCAN: NewScan = {
  createdAt: 1_700_000_000_000,
  imagePath: 'file:///scans/scan-1.jpg',
  topClass: 'tomato__LM',
  category: 'insect-pest',
  confidence: 0.82,
  lowConfidence: false,
  scores: [
    { classCode: 'tomato__LM', probability: 0.82 },
    { classCode: 'tomato__MIT', probability: 0.1 },
    { classCode: 'tomato__JAS_MIT', probability: 0.03 },
    { classCode: 'tomato__K', probability: 0.02 },
    { classCode: 'tomato__N', probability: 0.02 },
    { classCode: 'tomato__N_K', probability: 0.01 },
  ],
  provider: 'mock',
  modelVersion: 'mock',
  classOrderVerified: false,
};

describe('HistoryScreen', () => {
  beforeEach(() => {
    setScanRepository(new InMemoryScanRepository());
    useHistoryStore.setState({ status: 'idle', scans: [], error: null });
  });

  afterAll(() => {
    setScanRepository(null);
  });

  it('shows the empty state when nothing is saved', async () => {
    await renderHistory();
    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeTruthy());
    expect(screen.getByText('No scans yet')).toBeTruthy();
  });

  it('lists a saved scan with its class, category and whole percent', async () => {
    const repository = new InMemoryScanRepository();
    await repository.save(SCAN);
    setScanRepository(repository);

    await renderHistory();
    await waitFor(() => expect(screen.getByText('Leaf Miner')).toBeTruthy());
    expect(screen.getByText('Insect Pest')).toBeTruthy();
    expect(screen.getByText(/82%/)).toBeTruthy();
  });

  it('labels a low-confidence scan as uncertain, never as a diagnosis', async () => {
    const repository = new InMemoryScanRepository();
    await repository.save({ ...SCAN, lowConfidence: true, confidence: 0.3 });
    setScanRepository(repository);

    await renderHistory();
    await waitFor(() => expect(screen.getByText('Not classified reliably')).toBeTruthy());
    expect(screen.getByText('Uncertain')).toBeTruthy();
  });

  it('shows an explicit error state with retry when the database cannot be read', async () => {
    const broken = new InMemoryScanRepository();
    jest.spyOn(broken, 'list').mockRejectedValue(new Error('database is locked'));
    setScanRepository(broken);

    await renderHistory();
    await waitFor(() => expect(screen.getByTestId('history-error')).toBeTruthy());
    expect(screen.getByText('database is locked')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
