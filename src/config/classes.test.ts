import {
  approximateTestSupport,
  CLASS_CODES,
  CLASS_INFO,
  CLASS_ORDER_VERIFIED,
  categoryDisplayName,
  classCodeForIndex,
  isClassCode,
  isLimitedDataClass,
  NUM_CLASSES,
} from './classes';

describe('config/classes', () => {
  it('holds exactly the six known classes in the verified alphabetical order', () => {
    expect(CLASS_CODES).toEqual([
      'tomato__JAS_MIT',
      'tomato__K',
      'tomato__LM',
      'tomato__MIT',
      'tomato__N',
      'tomato__N_K',
    ]);
    expect(NUM_CLASSES).toBe(6);
  });

  it('is byte-for-byte what JS sort produces, matching the training script', () => {
    // The training script uses sorted(df['label'].unique()); Keras assigns
    // indices in that order. If the tuple above is ever reordered by hand,
    // this fails — the order is not a matter of taste.
    expect([...CLASS_CODES]).toEqual([...CLASS_CODES].sort());
  });

  it('is marked verified (confirmed against sorted dataset folder names)', () => {
    expect(CLASS_ORDER_VERIFIED).toBe(true);
  });

  it('maps indices to codes and throws out of range instead of guessing', () => {
    expect(classCodeForIndex(0)).toBe('tomato__JAS_MIT');
    expect(classCodeForIndex(5)).toBe('tomato__N_K');
    expect(() => classCodeForIndex(6)).toThrow(RangeError);
    expect(() => classCodeForIndex(-1)).toThrow(RangeError);
  });

  it('flags the four minority classes (< 15 test samples) as limited-data', () => {
    const limited = CLASS_CODES.filter(isLimitedDataClass);
    expect(limited).toEqual(['tomato__JAS_MIT', 'tomato__K', 'tomato__N', 'tomato__N_K']);
  });

  it('records the original OLID-I counts, totalling 562 images', () => {
    const total = CLASS_CODES.reduce((sum, code) => sum + CLASS_INFO[code].originalImageCount, 0);
    expect(total).toBe(562);
    expect(CLASS_INFO.tomato__LM.originalImageCount).toBe(207);
    expect(CLASS_INFO.tomato__JAS_MIT.originalImageCount).toBe(32);
  });

  it('derives per-class test support from the counts and the 15% split', () => {
    expect(approximateTestSupport('tomato__LM')).toBe(31);
    expect(approximateTestSupport('tomato__MIT')).toBe(30);
    expect(approximateTestSupport('tomato__N')).toBe(7);
    expect(approximateTestSupport('tomato__N_K')).toBe(6);
    expect(approximateTestSupport('tomato__K')).toBe(5);
    expect(approximateTestSupport('tomato__JAS_MIT')).toBe(5);
  });

  it('assigns each class the correct category', () => {
    expect(CLASS_INFO.tomato__LM.category).toBe('insect-pest');
    expect(CLASS_INFO.tomato__MIT.category).toBe('insect-pest');
    expect(CLASS_INFO.tomato__JAS_MIT.category).toBe('insect-pest');
    expect(CLASS_INFO.tomato__N.category).toBe('nutrient-deficiency');
    expect(CLASS_INFO.tomato__K.category).toBe('nutrient-deficiency');
    expect(CLASS_INFO.tomato__N_K.category).toBe('nutrient-deficiency');
  });

  it('narrows arbitrary strings safely', () => {
    expect(isClassCode('tomato__LM')).toBe(true);
    expect(isClassCode('healthy')).toBe(false);
  });

  it('renders category display names', () => {
    expect(categoryDisplayName('insect-pest')).toBe('Insect Pest');
    expect(categoryDisplayName('nutrient-deficiency')).toBe('Nutrient Deficiency');
  });
});
