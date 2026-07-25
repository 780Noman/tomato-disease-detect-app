import { CLASS_CODES, CLASS_INFO, type ClassCode } from '@/config/classes';

/**
 * Reference content for the six conditions.
 *
 * SCOPE LIMIT (approved in PLAN_REVIEW_AND_MODEL_UPDATE.md §3, Q5): this is
 * real, conservative, general guidance — symptom descriptions and cultural
 * controls only. It deliberately contains NO chemical or pesticide product
 * names and NO dosages, because a wrong dosage has real consequences and no
 * agronomist has signed off on specifics. Every entry escalates to a local
 * agricultural extension officer for treatment decisions.
 */

export interface LibraryEntry {
  readonly code: ClassCode;
  readonly displayName: string;
  readonly whatItIs: string;
  readonly symptoms: readonly string[];
  /** Non-chemical, low-risk actions a grower can take immediately. */
  readonly culturalControls: readonly string[];
  readonly confusedWith: readonly string[];
}

export const GUIDANCE_SCOPE_NOTE =
  'General guidance, pending review by a local agronomist. It intentionally excludes chemical products and dosages — ask an agricultural extension officer for treatment specific to your area and crop stage.';

const ENTRIES: Record<ClassCode, Omit<LibraryEntry, 'code' | 'displayName'>> = {
  tomato__LM: {
    whatItIs:
      'Leaf miner larvae feed inside the leaf, tunnelling between the upper and lower surfaces.',
    symptoms: [
      'Pale, winding tunnels or blotches just under the leaf surface',
      'Tunnels widen along their length as the larva grows',
      'Affected tissue dries and turns papery brown',
      'Heavier damage on older, lower leaves first',
    ],
    culturalControls: [
      'Pick off and destroy mined leaves — do not leave them on the soil',
      'Remove crop debris after harvest, where pupae overwinter',
      'Avoid excess nitrogen, which encourages soft, attractive foliage',
      'Check transplants before planting so mines are not carried in',
    ],
    confusedWith: ['Mite damage, when mining is fine and dense'],
  },
  tomato__MIT: {
    whatItIs:
      'Mites are tiny sap-feeding arachnids, usually on the underside of leaves, favoured by hot dry conditions.',
    symptoms: [
      'Fine pale stippling or speckling across the leaf',
      'A dull bronze or rusty cast as feeding continues',
      'Very fine webbing near veins or leaf joins in heavy infestations',
      'Leaves curl and dry from the edges inward',
    ],
    culturalControls: [
      'Inspect leaf undersides weekly with a hand lens — mites are hard to see',
      'Keep plants adequately watered; drought stress worsens outbreaks',
      'Remove and destroy the most heavily infested leaves',
      'Control dust on foliage and nearby paths, which favours mites',
      'Avoid moving between infested and clean plants without washing hands and tools',
    ],
    confusedWith: ['Early nutrient deficiency, when stippling is still faint'],
  },
  tomato__JAS_MIT: {
    whatItIs:
      'A combined infestation: jassids (leafhoppers) feeding alongside mites, so two damage patterns appear on the same leaf.',
    symptoms: [
      'Yellowing and upward curling at the leaf margins from jassid feeding',
      'Browning, scorched-looking leaf edges in heavier cases',
      'Mite stippling and bronzing across the leaf at the same time',
      'Small wedge-shaped insects that move sideways or hop when disturbed',
    ],
    culturalControls: [
      'Check both leaf surfaces — jassids sit on the underside and move quickly',
      'Remove weeds around the crop that host leafhoppers',
      'Destroy severely affected leaves rather than composting them nearby',
      'Keep watering even, since stressed plants suffer more from both pests',
    ],
    confusedWith: ['Mite alone', 'Potassium deficiency, which also scorches leaf margins'],
  },
  tomato__N: {
    whatItIs:
      'Nitrogen deficiency: the plant lacks the nitrogen needed for chlorophyll, so it cannibalises older leaves to feed new growth.',
    symptoms: [
      'Uniform pale-green to yellow older, lower leaves',
      'Yellowing spreads evenly, including between and across the veins',
      'Whole plant looks stunted with thin stems and small new leaves',
      'Upper leaves stay greener than lower ones',
    ],
    culturalControls: [
      'Confirm with a soil test before feeding — over-application causes its own problems',
      'Add well-rotted organic matter or compost to improve nitrogen supply',
      'Check for waterlogging or root damage, which prevents uptake even when nitrogen is present',
      'Ask an extension officer which fertiliser and rate suit your soil and stage',
    ],
    confusedWith: ['Potassium deficiency', 'Combined nitrogen + potassium deficiency'],
  },
  tomato__K: {
    whatItIs:
      'Potassium deficiency: potassium moves to fruit and new growth, so shortage shows first at the edges of older leaves.',
    symptoms: [
      'Yellowing that starts at the leaf margin and moves inward',
      'Margins turn brown and brittle, looking scorched',
      'Veins and the tissue beside them stay green longer than the edges',
      'Fruit may ripen unevenly with blotchy patches',
    ],
    culturalControls: [
      'Confirm with a soil test — margin scorch has several possible causes',
      'Keep soil moisture even; dry spells restrict potassium uptake',
      'Avoid heavy nitrogen feeding, which worsens the imbalance',
      'Ask an extension officer about a suitable potassium source and rate',
    ],
    confusedWith: ['Jassid margin damage', 'Combined nitrogen + potassium deficiency'],
  },
  tomato__N_K: {
    whatItIs:
      'Both nitrogen and potassium are short at once, so general yellowing and margin scorch appear together.',
    symptoms: [
      'Pale, generally yellow older leaves (nitrogen pattern)',
      'Brown, brittle scorched margins on the same leaves (potassium pattern)',
      'Clearly stunted plants with weak stems and poor fruit set',
      'Symptoms progress up the plant faster than a single deficiency',
    ],
    culturalControls: [
      'Get a soil test before correcting — treating one nutrient alone can worsen the imbalance',
      'Improve soil organic matter to support both nutrients',
      'Check root health, drainage and pH, which limit uptake of both',
      'Ask an extension officer for a correction plan; this combination needs a considered approach',
    ],
    confusedWith: ['Nitrogen deficiency alone', 'Potassium deficiency alone'],
  },
};

export const LIBRARY: readonly LibraryEntry[] = CLASS_CODES.map((code) => ({
  code,
  displayName: CLASS_INFO[code].displayName,
  ...ENTRIES[code],
}));

export function libraryEntry(code: ClassCode): LibraryEntry {
  const entry = LIBRARY.find((e) => e.code === code);
  if (entry === undefined) {
    throw new Error(`No library entry for class "${code}".`);
  }
  return entry;
}
