import type { TeamMemberSelection } from '../models/team';
import type { TypeChart } from '../models/type_effectiveness';
import { applyDefensiveAbility } from './ability_effects';
import {
  combineMultipliers,
  compareMultiplier,
  multiplyMultipliers,
  type ExactMultiplier,
} from './type_effectiveness';

const neutral: ExactMultiplier = { numerator: 1, denominator: 1 };
const moldBreakerFamily = new Set(['mold-breaker', 'teravolt', 'turboblaze']);
const ghostImmunityBypass = new Set(['scrappy', 'minds-eye']);
const unignorableDefensiveAbilities = new Set(['prism-armor']);

const attackerConditionalAbilities = new Set([
  'adaptability',
  'aerilate',
  'analytic',
  'battery',
  'blaze',
  'flare-boost',
  'flash-fire',
  'galvanize',
  'gorilla-tactics',
  'guts',
  'hadron-engine',
  'huge-power',
  'hustle',
  'iron-fist',
  'mega-launcher',
  'normalize',
  'orichalcum-pulse',
  'overgrow',
  'pixilate',
  'punk-rock',
  'pure-power',
  'refrigerate',
  'reckless',
  'rivalry',
  'sand-force',
  'sharpness',
  'sheer-force',
  'solar-power',
  'stakeout',
  'strong-jaw',
  'supreme-overlord',
  'swarm',
  'technician',
  'torrent',
  'tough-claws',
  'toxic-boost',
]);

const supportedAttackerAbilities = new Set([
  'aura-break',
  'dark-aura',
  'dragons-maw',
  'fairy-aura',
  'minds-eye',
  'mold-breaker',
  'neuroforce',
  'rocky-payload',
  'scrappy',
  'steelworker',
  'steely-spirit',
  'tinted-lens',
  'transistor',
  'teravolt',
  'turboblaze',
  'water-bubble',
]);

export type AttackingAbilitySupport =
  | 'supported'
  | 'conditional_unmodeled'
  | 'not_applicable';

export function attackingAbilitySupport(identifier: string): AttackingAbilitySupport {
  if (supportedAttackerAbilities.has(identifier)) return 'supported';
  if (attackerConditionalAbilities.has(identifier)) return 'conditional_unmodeled';
  return 'not_applicable';
}

function minimumGeneration(identifier: string): number {
  const introductions: Record<string, number> = {
    'mold-breaker': 4,
    'tinted-lens': 4,
    scrappy: 4,
    teravolt: 5,
    turboblaze: 5,
    'aura-break': 6,
    'dark-aura': 6,
    'fairy-aura': 6,
    neuroforce: 7,
    'water-bubble': 7,
    steelworker: 7,
    'steely-spirit': 8,
    transistor: 8,
    'dragons-maw': 8,
    'rocky-payload': 9,
    'minds-eye': 9,
  };
  return introductions[identifier] ?? 1;
}

function abilityIsActive(identifier: string | null, generationId: number): boolean {
  return Boolean(identifier && generationId >= minimumGeneration(identifier));
}

function baseTypeMultiplier(
  chart: TypeChart,
  attackingTypeId: number,
  defender: TeamMemberSelection,
  attackerAbilityIdentifier: string | null,
): ExactMultiplier | undefined {
  const attackingType = chart.types.find((type) => type.id === attackingTypeId);
  if (!attackingType) return undefined;

  const bypassesGhost =
    abilityIsActive(attackerAbilityIdentifier, chart.generationId) &&
    ghostImmunityBypass.has(attackerAbilityIdentifier ?? '') &&
    (attackingType.identifier === 'normal' || attackingType.identifier === 'fighting');

  const entries = defender.types.map((defendingType) => {
    if (bypassesGhost && defendingType.identifier === 'ghost') {
      return neutral;
    }
    return chart.matchups.find(
      (entry) =>
        entry.attackingTypeId === attackingTypeId &&
        entry.defendingTypeId === defendingType.id,
    );
  });
  if (entries.some((entry) => !entry)) return undefined;
  return combineMultipliers(
    entries.map((entry) => ({
      numerator: entry!.numerator,
      denominator: entry!.denominator,
    })),
  );
}

function effectiveDefenderAbility(
  attackerAbilityIdentifier: string | null,
  defenderAbilityIdentifier: string | null,
  generationId: number,
): string | null {
  if (!defenderAbilityIdentifier) return null;
  const breaksAbilities =
    abilityIsActive(attackerAbilityIdentifier, generationId) &&
    moldBreakerFamily.has(attackerAbilityIdentifier ?? '');
  if (
    breaksAbilities &&
    !unignorableDefensiveAbilities.has(defenderAbilityIdentifier)
  ) {
    return null;
  }
  return defenderAbilityIdentifier;
}

function applyAttackingAbility({
  multiplier,
  baseMultiplier,
  attackingTypeIdentifier,
  attackerAbilityIdentifier,
  defenderAbilityIdentifier,
  generationId,
}: {
  multiplier: ExactMultiplier;
  baseMultiplier: ExactMultiplier;
  attackingTypeIdentifier: string;
  attackerAbilityIdentifier: string | null;
  defenderAbilityIdentifier: string | null;
  generationId: number;
}): ExactMultiplier {
  let result = multiplier;
  if (!attackerAbilityIdentifier) return applyAura(result);

  if (
    attackerAbilityIdentifier === 'tinted-lens' &&
    generationId >= 4 &&
    baseMultiplier.numerator > 0 &&
    compareMultiplier(baseMultiplier, neutral) < 0
  ) {
    result = multiplyMultipliers(result, { numerator: 2, denominator: 1 });
  }
  if (
    attackerAbilityIdentifier === 'neuroforce' &&
    generationId >= 7 &&
    compareMultiplier(baseMultiplier, neutral) > 0
  ) {
    result = multiplyMultipliers(result, { numerator: 5, denominator: 4 });
  }

  const typeBoosts: Record<string, { type: string; generation: number; multiplier: ExactMultiplier }> = {
    'water-bubble': { type: 'water', generation: 7, multiplier: { numerator: 2, denominator: 1 } },
    steelworker: { type: 'steel', generation: 7, multiplier: { numerator: 3, denominator: 2 } },
    'steely-spirit': { type: 'steel', generation: 8, multiplier: { numerator: 3, denominator: 2 } },
    'dragons-maw': { type: 'dragon', generation: 8, multiplier: { numerator: 3, denominator: 2 } },
    'rocky-payload': { type: 'rock', generation: 9, multiplier: { numerator: 3, denominator: 2 } },
  };
  const boost = typeBoosts[attackerAbilityIdentifier];
  if (
    boost &&
    generationId >= boost.generation &&
    attackingTypeIdentifier === boost.type
  ) {
    result = multiplyMultipliers(result, boost.multiplier);
  }
  if (
    attackerAbilityIdentifier === 'transistor' &&
    generationId >= 8 &&
    attackingTypeIdentifier === 'electric'
  ) {
    result = multiplyMultipliers(
      result,
      generationId === 8
        ? { numerator: 3, denominator: 2 }
        : { numerator: 13, denominator: 10 },
    );
  }

  return applyAura(result);

  function applyAura(value: ExactMultiplier): ExactMultiplier {
    const auraMatches =
      (attackingTypeIdentifier === 'dark' &&
        [attackerAbilityIdentifier, defenderAbilityIdentifier].includes('dark-aura')) ||
      (attackingTypeIdentifier === 'fairy' &&
        [attackerAbilityIdentifier, defenderAbilityIdentifier].includes('fairy-aura'));
    if (!auraMatches || generationId < 6) return value;
    const auraBroken = [attackerAbilityIdentifier, defenderAbilityIdentifier].includes('aura-break');
    return multiplyMultipliers(
      value,
      auraBroken
        ? { numerator: 3, denominator: 4 }
        : { numerator: 4, denominator: 3 },
    );
  }
}

export function calculateTeamMatchupMultiplier(
  chart: TypeChart,
  attackingTypeId: number,
  attacker: TeamMemberSelection,
  defender: TeamMemberSelection,
): ExactMultiplier | undefined {
  const attackingType = chart.types.find((type) => type.id === attackingTypeId);
  if (!attackingType) return undefined;

  const attackerAbilityIdentifier = attacker.ability?.identifier ?? null;
  const defenderAbilityIdentifier = defender.ability?.identifier ?? null;
  const baseMultiplier = baseTypeMultiplier(
    chart,
    attackingTypeId,
    defender,
    attackerAbilityIdentifier,
  );
  if (!baseMultiplier) return undefined;

  const afterDefense = applyDefensiveAbility({
    multiplier: baseMultiplier,
    attackingTypeIdentifier: attackingType.identifier,
    abilityIdentifier: effectiveDefenderAbility(
      attackerAbilityIdentifier,
      defenderAbilityIdentifier,
      chart.generationId,
    ),
    generationId: chart.generationId,
  });

  return applyAttackingAbility({
    multiplier: afterDefense,
    baseMultiplier,
    attackingTypeIdentifier: attackingType.identifier,
    attackerAbilityIdentifier,
    defenderAbilityIdentifier,
    generationId: chart.generationId,
  });
}
