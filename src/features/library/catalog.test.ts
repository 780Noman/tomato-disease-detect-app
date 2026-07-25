import { GUIDANCE_SCOPE_NOTE, LIBRARY, libraryEntry } from './catalog';
import { CLASS_CODES } from '@/config/classes';

describe('library catalog', () => {
  it('covers all six classes in config order', () => {
    expect(LIBRARY.map((e) => e.code)).toEqual([...CLASS_CODES]);
  });

  it('gives every entry real content — no stubs', () => {
    for (const entry of LIBRARY) {
      expect(entry.whatItIs.length).toBeGreaterThan(40);
      expect(entry.symptoms.length).toBeGreaterThanOrEqual(3);
      expect(entry.culturalControls.length).toBeGreaterThanOrEqual(3);
      expect(entry.confusedWith.length).toBeGreaterThanOrEqual(1);
      for (const line of [...entry.symptoms, ...entry.culturalControls]) {
        expect(line.trim().length).toBeGreaterThan(10);
        expect(line).not.toMatch(/TODO|TBD|placeholder|lorem/i);
      }
    }
  });

  it('names no chemical products or dosages (awaiting agronomist sign-off)', () => {
    // Guidance is cultural-controls only; a dosage here would be unsafe.
    const banned =
      /\b(mg|ml|litre|liter|g\/l|kg\/ha|spray with|imidacloprid|abamectin|chlorantraniliprole|dosage|dose\b)/i;
    for (const entry of LIBRARY) {
      const text = [entry.whatItIs, ...entry.symptoms, ...entry.culturalControls].join(' ');
      expect(text).not.toMatch(banned);
    }
  });

  it('escalates to an extension officer where treatment specifics are needed', () => {
    expect(GUIDANCE_SCOPE_NOTE).toMatch(/extension officer/i);
    expect(GUIDANCE_SCOPE_NOTE).toMatch(/pending review/i);
  });

  it('flags the N/K/N_K confusion the model is known to have', () => {
    expect(libraryEntry('tomato__N').confusedWith.join(' ')).toMatch(/potassium/i);
    expect(libraryEntry('tomato__K').confusedWith.join(' ')).toMatch(/nitrogen \+ potassium/i);
    expect(libraryEntry('tomato__N_K').confusedWith.join(' ')).toMatch(/nitrogen|potassium/i);
  });

  it('throws for an unknown class rather than returning empty content', () => {
    // @ts-expect-error deliberately invalid class code
    expect(() => libraryEntry('tomato__HEALTHY')).toThrow();
  });
});
