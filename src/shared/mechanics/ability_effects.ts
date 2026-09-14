import type { ExactMultiplier } from './type_effectiveness';
import { compareMultiplier, multiplyMultipliers } from './type_effectiveness';

export type AbilitySupport =
  | 'supported'
  | 'partially_supported'
  | 'conditional_unmodeled'
  | 'not_applicable';

const conditionalAbilities = new Set([
  'air-lock',
  'bulletproof',
  'cloud-nine',
  'delta-stream',
  'desolate-land',
  'disguise',
  'friend-guard',
  'fur-coat',
  'grass-pelt',
  'ice-face',
  'ice-scales',
  'magic-guard',
  'marvel-scale',
  'multiscale',
  'overcoat',
  'primordial-sea',
  'punk-rock',
  'shadow-shield',
  'soundproof',
  'tablets-of-ruin',
  'telepathy',
  'tera-shell',
  'vessel-of-ruin',
  'wind-rider',
]);

const supportedAbilities = new Set([
  'dry-skin',
  'earth-eater',
  'filter',
  'flash-fire',
  'heatproof',
  'levitate',
  'lightning-rod',
  'motor-drive',
  'prism-armor',
  'purifying-salt',
  'sap-sipper',
  'solid-rock',
  'storm-drain',
  'thick-fat',
  'volt-absorb',
  'water-absorb',
  'water-bubble',
  'well-baked-body',
  'wonder-guard',
]);

export function abilitySupport(identifier: string): AbilitySupport {
  if (identifier === 'fluffy') return 'partially_supported';
  if (supportedAbilities.has(identifier)) return 'supported';
  if (conditionalAbilities.has(identifier)) return 'conditional_unmodeled';
  return 'not_applicable';
}

export function applyDefensiveAbility({
  multiplier,
  attackingTypeIdentifier,
  abilityIdentifier,
  generationId,
}: {
  multiplier: ExactMultiplier;
  attackingTypeIdentifier: string;
  abilityIdentifier: string | null;
  generationId: number;
}): ExactMultiplier {
  if (!abilityIdentifier) return multiplier;

  const immunities: Record<string, { type: string; minimumGeneration: number }> = {
    'earth-eater': { type: 'ground', minimumGeneration: 9 },
    'flash-fire': { type: 'fire', minimumGeneration: 3 },
    levitate: { type: 'ground', minimumGeneration: 3 },
    'lightning-rod': { type: 'electric', minimumGeneration: 5 },
    'motor-drive': { type: 'electric', minimumGeneration: 4 },
    'sap-sipper': { type: 'grass', minimumGeneration: 5 },
    'storm-drain': { type: 'water', minimumGeneration: 5 },
    'volt-absorb': { type: 'electric', minimumGeneration: 3 },
    'water-absorb': { type: 'water', minimumGeneration: 3 },
    'well-baked-body': { type: 'fire', minimumGeneration: 9 },
  };
  const immunity = immunities[abilityIdentifier];
  if (
    immunity &&
    generationId >= immunity.minimumGeneration &&
    attackingTypeIdentifier === immunity.type
  ) {
    return { numerator: 0, denominator: 1 };
  }

  if (
    abilityIdentifier === 'fluffy' &&
    generationId >= 7 &&
    attackingTypeIdentifier === 'fire'
  ) {
    multiplier = multiplyMultipliers(multiplier, { numerator: 2, denominator: 1 });
  }

  if (abilityIdentifier === 'dry-skin' && generationId >= 4) {
    if (attackingTypeIdentifier === 'water') {
      return { numerator: 0, denominator: 1 };
    }
    if (attackingTypeIdentifier === 'fire') {
      return multiplyMultipliers(multiplier, { numerator: 5, denominator: 4 });
    }
  }

  if (
    abilityIdentifier === 'thick-fat' &&
    generationId >= 3 &&
    (attackingTypeIdentifier === 'fire' || attackingTypeIdentifier === 'ice')
  ) {
    return multiplyMultipliers(multiplier, { numerator: 1, denominator: 2 });
  }
  if (
    abilityIdentifier === 'heatproof' &&
    generationId >= 4 &&
    attackingTypeIdentifier === 'fire'
  ) {
    return multiplyMultipliers(multiplier, { numerator: 1, denominator: 2 });
  }
  if (
    abilityIdentifier === 'water-bubble' &&
    generationId >= 7 &&
    attackingTypeIdentifier === 'fire'
  ) {
    return multiplyMultipliers(multiplier, { numerator: 1, denominator: 2 });
  }
  if (
    abilityIdentifier === 'purifying-salt' &&
    generationId >= 9 &&
    attackingTypeIdentifier === 'ghost'
  ) {
    return multiplyMultipliers(multiplier, { numerator: 1, denominator: 2 });
  }
  if (
    ['filter', 'solid-rock', 'prism-armor'].includes(abilityIdentifier) &&
    compareMultiplier(multiplier, { numerator: 1, denominator: 1 }) > 0
  ) {
    return multiplyMultipliers(multiplier, { numerator: 3, denominator: 4 });
  }
  if (
    abilityIdentifier === 'wonder-guard' &&
    compareMultiplier(multiplier, { numerator: 1, denominator: 1 }) <= 0
  ) {
    return { numerator: 0, denominator: 1 };
  }

  return multiplier;
}
