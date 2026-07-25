import {
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
  it('holds exactly the six known classes in the expected alphabetical order', () => {
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

  it('ships UNVERIFIED — flipping this flag requires model metadata, not a code review', () => {
    expect(CLASS_ORDER_VERIFIED).toBe(false);
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
