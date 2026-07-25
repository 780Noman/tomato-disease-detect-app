import {
  confidenceBand,
  confidenceBandLabel,
  displayPercent,
  LOW_CONFIDENCE_THRESHOLD,
} from './thresholds';

describe('config/thresholds', () => {
  it('starts the low-confidence cutoff at 0.60 as specified', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.6);
  });

  it('assigns bands with the boundaries inclusive at the bottom', () => {
    expect(confidenceBand(0.95)).toBe('high');
    expect(confidenceBand(0.8)).toBe('high');
    expect(confidenceBand(0.79)).toBe('medium');
    expect(confidenceBand(0.6)).toBe('medium');
    expect(confidenceBand(0.59)).toBe('low');
    expect(confidenceBand(0)).toBe('low');
  });

  it('labels every band', () => {
    expect(confidenceBandLabel('high')).toBe('High confidence');
    expect(confidenceBandLabel('medium')).toBe('Medium confidence');
    expect(confidenceBandLabel('low')).toBe('Low confidence');
  });

  it('rounds honestly to whole percentages — never fake precision', () => {
    expect(displayPercent(0.873)).toBe('87%');
    expect(displayPercent(0.875)).toBe('88%');
    expect(displayPercent(1)).toBe('100%');
    expect(displayPercent(0)).toBe('0%');
  });
});
