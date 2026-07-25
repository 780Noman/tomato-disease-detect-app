import { screen } from '@testing-library/react-native';

import { ResultsView } from './ResultsView';
import type { Classification, ClassScore } from '@/inference';
import { renderWithTheme } from '@/test/renderWithTheme';

function classification(vector: Record<string, number>, lowConfidence: boolean): Classification {
  const scores = Object.entries(vector)
    .map(([classCode, probability]) => ({ classCode, probability }) as ClassScore)
    .sort((a, b) => b.probability - a.probability);
  const top = scores[0] as ClassScore;
  return { scores, top, lowConfidence, provider: 'mock', modelVersion: 'test', durationMs: 5 };
}

const URI = 'file:///photos/leaf.jpg';

describe('ResultsView — CLAUDE.md §7 honest UI', () => {
  it('leads with the category, then the class, band and whole percent', async () => {
    const result = classification(
      {
        tomato__LM: 0.82,
        tomato__MIT: 0.08,
        tomato__JAS_MIT: 0.04,
        tomato__K: 0.03,
        tomato__N: 0.02,
        tomato__N_K: 0.01,
      },
      false,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);

    expect(screen.getByText('Insect Pest')).toBeTruthy();
    // Headline + top-3 bar label both name the class.
    expect(screen.getAllByText('Leaf Miner').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/High confidence · 82%/)).toBeTruthy();
    expect(screen.getByText('Top predictions')).toBeTruthy();
  });

  it('shows exactly the top three ranked predictions', async () => {
    const result = classification(
      {
        tomato__N: 0.66,
        tomato__N_K: 0.18,
        tomato__K: 0.09,
        tomato__LM: 0.03,
        tomato__MIT: 0.02,
        tomato__JAS_MIT: 0.02,
      },
      false,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);

    expect(screen.getByTestId('prediction-0')).toBeTruthy();
    expect(screen.getByTestId('prediction-1')).toBeTruthy();
    expect(screen.getByTestId('prediction-2')).toBeTruthy();
    expect(screen.queryByTestId('prediction-3')).toBeNull();
    expect(screen.getAllByText('Nitrogen Deficiency').length).toBeGreaterThanOrEqual(1);
  });

  it('treats low confidence as a first-class result framed as possibilities', async () => {
    const result = classification(
      {
        tomato__LM: 0.22,
        tomato__N: 0.2,
        tomato__MIT: 0.19,
        tomato__N_K: 0.16,
        tomato__K: 0.13,
        tomato__JAS_MIT: 0.1,
      },
      true,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);

    expect(screen.getByTestId('low-confidence-result')).toBeTruthy();
    expect(screen.getByText(/could not be classified reliably/)).toBeTruthy();
    expect(screen.getByText(/extension officer/)).toBeTruthy();
    expect(screen.getByText('Possibilities — not a diagnosis')).toBeTruthy();
    expect(screen.queryByTestId('diagnosis-result')).toBeNull();
  });

  it('carries the limited-data caveat for weakly-supported classes', async () => {
    const result = classification(
      {
        tomato__JAS_MIT: 0.71,
        tomato__MIT: 0.12,
        tomato__LM: 0.08,
        tomato__K: 0.04,
        tomato__N: 0.03,
        tomato__N_K: 0.02,
      },
      false,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);

    expect(screen.getByTestId('limited-data-caveat')).toBeTruthy();
    expect(screen.getByText(/confirmed\s+by an expert|confirmed by an expert/)).toBeTruthy();
  });

  it('omits the caveat for well-supported classes', async () => {
    const result = classification(
      {
        tomato__LM: 0.82,
        tomato__MIT: 0.1,
        tomato__JAS_MIT: 0.03,
        tomato__K: 0.02,
        tomato__N: 0.02,
        tomato__N_K: 0.01,
      },
      false,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);
    expect(screen.queryByTestId('limited-data-caveat')).toBeNull();
  });

  it('always shows the no-healthy-class note', async () => {
    const result = classification(
      {
        tomato__MIT: 0.9,
        tomato__LM: 0.04,
        tomato__JAS_MIT: 0.02,
        tomato__K: 0.02,
        tomato__N: 0.01,
        tomato__N_K: 0.01,
      },
      false,
    );
    await renderWithTheme(<ResultsView imageUri={URI} result={result} />);
    expect(screen.getByTestId('no-healthy-note')).toBeTruthy();
    expect(
      screen.getByText(/does not\s+detect healthy leaves|does not detect healthy leaves/),
    ).toBeTruthy();
  });
});
