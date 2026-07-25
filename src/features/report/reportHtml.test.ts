import { buildReportHtml } from './reportHtml';
import type { SavedScan } from '@/features/history/types';

function scan(overrides: Partial<SavedScan> = {}): SavedScan {
  return {
    id: 1,
    createdAt: 1_700_000_000_000,
    imagePath: 'file:///scans/scan-1.jpg',
    topClass: 'tomato__LM',
    category: 'insect-pest',
    confidence: 0.823,
    lowConfidence: false,
    scores: [
      { classCode: 'tomato__LM', probability: 0.823 },
      { classCode: 'tomato__MIT', probability: 0.1 },
      { classCode: 'tomato__JAS_MIT', probability: 0.03 },
      { classCode: 'tomato__K', probability: 0.02 },
      { classCode: 'tomato__N', probability: 0.017 },
      { classCode: 'tomato__N_K', probability: 0.01 },
    ],
    provider: 'tflite',
    modelVersion: 'tflite-ondevice',
    classOrderVerified: true,
    ...overrides,
  };
}

describe('buildReportHtml — the PDF carries the same honesty rules as the screen', () => {
  it('leads with the category and names the class', () => {
    const html = buildReportHtml(scan(), null);
    expect(html).toContain('Insect Pest');
    expect(html).toContain('Leaf Miner');
  });

  it('rounds to whole percentages — never 82.3%', () => {
    const html = buildReportHtml(scan(), null);
    expect(html).toContain('82%');
    expect(html).not.toContain('82.3');
  });

  it('never contains an accuracy claim', () => {
    const html = buildReportHtml(scan(), null);
    expect(html).not.toMatch(/accurac/i);
    expect(html).not.toMatch(/AI[- ]verified/i);
  });

  it('shows only the top three predictions', () => {
    const html = buildReportHtml(scan(), null);
    expect(html).toContain('Leaf Miner');
    expect(html).toContain('Mite');
    expect(html).toContain('Jassid + Mite');
    // 4th-ranked class must not appear in the bars section.
    const bars = html.slice(html.indexOf('Top predictions'), html.indexOf('what to look for'));
    expect(bars).not.toContain('Potassium Deficiency');
  });

  it('makes low confidence the headline, framed as possibilities', () => {
    const html = buildReportHtml(scan({ lowConfidence: true, confidence: 0.34 }), null);
    expect(html).toContain('could not be classified reliably');
    expect(html).toContain('Possibilities — not a diagnosis');
    expect(html).toMatch(/extension officer/i);
  });

  it('adds the limited-data caveat for weakly-supported classes only', () => {
    const rare = buildReportHtml(
      scan({ topClass: 'tomato__JAS_MIT', category: 'insect-pest' }),
      null,
    );
    expect(rare).toContain('Limited training data');
    expect(buildReportHtml(scan(), null)).not.toContain('Limited training data');
  });

  it('always carries the no-healthy-class note', () => {
    expect(buildReportHtml(scan(), null)).toMatch(/does not detect\s+healthy leaves/);
  });

  it('marks a scan taken while the class order was unverified', () => {
    const html = buildReportHtml(scan({ classOrderVerified: false }), null);
    expect(html).toMatch(/class order was still unverified/);
  });

  it('says so plainly when the photo is gone rather than showing a broken image', () => {
    const html = buildReportHtml(scan(), null);
    expect(html).toContain('no longer available on this device');
    expect(html).not.toContain('<img');
  });

  it('embeds the photo as a data URI when available', () => {
    const html = buildReportHtml(scan(), 'data:image/jpeg;base64,AAAA');
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
  });

  it('escapes HTML in text it interpolates', () => {
    // Guards against markup injection from stored/derived strings.
    const html = buildReportHtml(scan(), null);
    expect(html).not.toMatch(/<script/i);
  });
});
