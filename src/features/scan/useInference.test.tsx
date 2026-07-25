import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useInference } from './useInference';
import { resetInferenceProvider } from '@/inference';

// Uses the REAL MockProvider through the factory (env defaults to mock in
// tests) — deterministic by design, so no stubbing is needed.

function Harness({ uri }: { uri: string }) {
  const { status } = useInference(uri);
  return (
    <>
      <Text testID="state">{status.state}</Text>
      {status.state === 'success' ? <Text testID="top">{status.result.top.classCode}</Text> : null}
      {status.state === 'error' ? <Text testID="code">{status.code}</Text> : null}
    </>
  );
}

describe('useInference', () => {
  afterEach(() => {
    resetInferenceProvider();
  });

  it('reaches success with a full classification', async () => {
    await render(<Harness uri="file:///photos/leaf-1.jpg" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('success'));
    expect(screen.getByTestId('top').props.children).toMatch(/^tomato__/);
  });

  it('surfaces a typed error state with its code', async () => {
    await render(<Harness uri="mock://error/timeout" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('error'));
    expect(screen.getByTestId('code')).toHaveTextContent('timeout');
  });
});
