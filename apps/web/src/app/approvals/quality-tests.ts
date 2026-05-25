/**
 * SOP test reference content — what the Quality dashboard's side panel shows
 * for the currently-selected task. Mirrors `requiredTests: string[]` on the
 * server-side SOP records. Hand-curated copy; the real product would store
 * this in the SOP table itself.
 */

export interface QualityTestDetail {
  /** Display name on the table's SOP TEST column + side-panel header. */
  label: string;
  /** "v3" style version tag. */
  version: string;
  /** One-sentence description. */
  description: string;
  /** Bulleted pass criteria. */
  passCriteria: string[];
  /** Bulleted common reject reasons. */
  commonRejects: string[];
  /** Hex-colour CSS for the placeholder reference photo background. */
  refTint: string;
}

const TILE_TEST: QualityTestDetail = {
  label: 'Marble level test',
  version: 'v3',
  description: 'Ceramic / vitrified tile flatness check across the diagonal of the installed area, using a 1-m straightedge + feeler gauge + hollow-tap rod.',
  passCriteria: [
    'Gap under straightedge ≤ 2 mm over 1 m',
    'No lippage between adjacent tiles',
    'Hollow-sound check < 5 % by area',
    'Grout gap consistent at 2 mm ± 0.5 mm',
  ],
  commonRejects: [
    'Visible cracks — auto reject',
    'Edge lippage > 2 mm',
    'Wrong grout gap width',
    'Hollow under tile (> 5 % area)',
  ],
  refTint: 'linear-gradient(135deg, #E2E8F0, #94A3B8 70%, #475569)',
};

const PAINT_TEST: QualityTestDetail = {
  label: 'Scratch test',
  version: 'v2',
  description: 'Adhesion + DFT check on 2-coat emulsion. Coin-edge scratch + uniform-light visual inspection at 1 m from the wall.',
  passCriteria: [
    'No exposed primer/substrate under scratch',
    'Dry-film thickness 80–100 μm total',
    'No brush marks visible from 1 m',
    'Even sheen across the whole wall',
  ],
  commonRejects: [
    'Drip marks on trim',
    'Patchy coverage / visible primer',
    'Brush marks visible at 1 m',
    'Colour mismatch with sample',
  ],
  refTint: 'linear-gradient(160deg, #FEF3C7, #FDE68A 40%, #F59E0B 100%)',
};

const PLASTER_TEST: QualityTestDetail = {
  label: 'Blue-light flatness',
  version: 'v2',
  description: 'Wall plaster flatness + plumb check using a long-bar spirit level and an angled blue-LED to reveal undulations the eye misses.',
  passCriteria: [
    'Plumb ± 3 mm over 3 m height',
    'No undulations visible under raking blue light',
    'Trowel marks fully smoothed',
    'Curing maintained ≥ 7 days',
  ],
  commonRejects: [
    'Undulations > 3 mm',
    'Trowel-mark ridges',
    'Visible cracks (shrinkage)',
    'Hollow areas at corners',
  ],
  refTint: 'linear-gradient(160deg, #E7E5E4, #A8A29E 70%, #57534E)',
};

const RCC_TEST: QualityTestDetail = {
  label: 'Rebound hammer',
  version: 'v4',
  description: 'Schmidt hammer reading at 5 random points per 30 m³ pour to estimate in-situ M25 strength. Cube samples cross-check at 7/28 days.',
  passCriteria: [
    'Average rebound number ≥ 32',
    'Per-point variance < 6 units',
    'Cube sample 7-day strength ≥ 0.65 × design',
    'No visible cold joints or honeycombing',
  ],
  commonRejects: [
    'Average rebound < 28',
    'Visible honeycombing',
    'Cold joint between pours',
    'Cube strength below 0.65 × design',
  ],
  refTint: 'linear-gradient(135deg, #71717A, #3F3F46 60%, #18181B)',
};

const MARBLE_TEST: QualityTestDetail = {
  label: 'Diagonal-light flat',
  version: 'v2',
  description: 'Polished-marble flatness check with a diagonal halogen + 2-m straightedge; supplements the standard level test.',
  passCriteria: [
    'No light gap under a 2-m straightedge',
    'Polish stage 3 mirror finish',
    'Joint width ≤ 1 mm',
    'No staining around joints',
  ],
  commonRejects: [
    'Visible joint gap',
    'Polish stage 2 leaves swirl marks',
    'Stain around joints',
    'Edge chip on installation',
  ],
  refTint: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 30%, #94A3B8 70%, #475569)',
};

const ELECTRICAL_TEST: QualityTestDetail = {
  label: 'Megger insulation',
  version: 'v1',
  description: '500 V insulation-resistance test on each circuit before plastering covers the conduits.',
  passCriteria: [
    'IR ≥ 100 MΩ on every circuit',
    'No earth-fault on RCD test',
    'Phase + neutral correctly identified',
    'Conduit runs continuous (no broken sections)',
  ],
  commonRejects: [
    'IR < 50 MΩ on any circuit',
    'Reverse polarity at outlet',
    'Earth missing at switch box',
    'Conduit kinked / crushed',
  ],
  refTint: 'linear-gradient(160deg, #FEF9C3 0%, #FACC15 40%, #A16207 100%)',
};

/** Pick the canonical quality test for a task based on its trade. */
export function testForTrade(trade: string): QualityTestDetail {
  const t = (trade ?? '').toLowerCase();
  if (t.includes('tile') || t.includes('grout')) return TILE_TEST;
  if (t.includes('paint')) return PAINT_TEST;
  if (t.includes('plaster')) return PLASTER_TEST;
  if (t.includes('rcc') || t.includes('slab') || t.includes('concrete')) return RCC_TEST;
  if (t.includes('marble')) return MARBLE_TEST;
  if (t.includes('electric') || t.includes('wiring')) return ELECTRICAL_TEST;
  return TILE_TEST; // safe default — every site has tiling
}

/** Risk band derived from rework count + trade. Deterministic so the chip
 *  doesn't flicker between renders. */
export function riskFor(task: { reworkCount?: number | null; trade: string }): 'LOW' | 'MED' | 'HIGH' {
  const r = task.reworkCount ?? 0;
  if (r >= 2) return 'HIGH';
  if (r === 1) return 'MED';
  const t = (task.trade ?? '').toLowerCase();
  // RCC + electrical are higher consequence even on first pass.
  if (t.includes('rcc') || t.includes('slab') || t.includes('electric')) return 'MED';
  return 'LOW';
}
