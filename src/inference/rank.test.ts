import { InferenceError } from './errors';
import { toClassification } from './rank';

const META = { provider: 'mock' as const, modelVersion: 'test', durationMs: 1 };

describe('toClassification', () => {
  it('sorts all six classes descending and picks the top', () => {
    //                JAS    K     LM    MIT   N     N_K
    const result = toClassification([0.05, 0.1, 0.5, 0.2, 0.1, 0.05], META);
    expect(result.scores).toHaveLength(6);
    expect(result.top.classCode).toBe('tomato__LM');
    expect(result.scores.map((s) => s.classCode).slice(0, 2)).toEqual([
      'tomato__LM',
      'tomato__MIT',
    ]);
    const probs = result.scores.map((s) => s.probability);
    expect([...probs].sort((a, b) => b - a)).toEqual(probs);
  });

  it('marks low confidence strictly below the 0.60 threshold', () => {
    expect(toClassification([0.59, 0.11, 0.1, 0.1, 0.05, 0.05], META).lowConfidence).toBe(true);
    expect(toClassification([0.6, 0.1, 0.1, 0.1, 0.05, 0.05], META).lowConfidence).toBe(false);
  });

  it('rejects a vector of the wrong length', () => {
    expect(() => toClassification([0.5, 0.5], META)).toThrow(InferenceError);
    try {
      toClassification([0.5, 0.5], META);
    } catch (error) {
      expect((error as InferenceError).code).toBe('invalid-response');
    }
  });

  it('rejects non-finite and out-of-range values', () => {
    expect(() => toClassification([NaN, 0.2, 0.2, 0.2, 0.2, 0.2], META)).toThrow(InferenceError);
    expect(() => toClassification([1.4, 0.1, 0.1, 0.1, 0.1, 0.1], META)).toThrow(InferenceError);
    expect(() => toClassification([-0.2, 0.3, 0.3, 0.2, 0.2, 0.2], META)).toThrow(InferenceError);
  });

  it('rejects vectors that do not sum to ~1 (logits are not probabilities)', () => {
    expect(() => toClassification([0.9, 0.9, 0.9, 0.9, 0.9, 0.9], META)).toThrow(/sum to 5.4000/i);
  });

  it('carries provider metadata through', () => {
    const result = toClassification([0.9, 0.02, 0.02, 0.02, 0.02, 0.02], META);
    expect(result.provider).toBe('mock');
    expect(result.modelVersion).toBe('test');
    expect(result.durationMs).toBe(1);
  });
});
