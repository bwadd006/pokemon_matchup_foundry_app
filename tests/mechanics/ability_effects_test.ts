import { describe, expect, it } from 'vitest';

import {
  abilitySupport,
  applyDefensiveAbility,
} from '../../src/shared/mechanics/ability_effects';
import { formatMultiplier } from '../../src/shared/mechanics/type_effectiveness';

const neutral = { numerator: 1, denominator: 1 };
const weak = { numerator: 2, denominator: 1 };

function apply(
  abilityIdentifier: string,
  attackingTypeIdentifier: string,
  generationId = 9,
  multiplier = neutral,
) {
  return applyDefensiveAbility({
    multiplier,
    attackingTypeIdentifier,
    abilityIdentifier,
    generationId,
  });
}

describe('defensive ability effects', () => {
  it.each([
    ['levitate', 'ground'],
    ['flash-fire', 'fire'],
    ['volt-absorb', 'electric'],
    ['water-absorb', 'water'],
    ['motor-drive', 'electric'],
    ['sap-sipper', 'grass'],
    ['earth-eater', 'ground'],
    ['well-baked-body', 'fire'],
  ])('%s grants its unconditional type immunity', (ability, type) => {
    expect(apply(ability, type, 9, weak)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('uses the historical Lightning Rod and Storm Drain mechanics', () => {
    expect(apply('lightning-rod', 'electric', 4)).toEqual(neutral);
    expect(apply('lightning-rod', 'electric', 5)).toEqual({ numerator: 0, denominator: 1 });
    expect(apply('storm-drain', 'water', 4)).toEqual(neutral);
    expect(apply('storm-drain', 'water', 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('halves matching damage for Thick Fat and related abilities', () => {
    expect(apply('thick-fat', 'fire', 9, weak)).toEqual(neutral);
    expect(apply('thick-fat', 'ice', 9)).toEqual({ numerator: 1, denominator: 2 });
    expect(apply('heatproof', 'fire', 9)).toEqual({ numerator: 1, denominator: 2 });
    expect(apply('water-bubble', 'fire', 9)).toEqual({ numerator: 1, denominator: 2 });
    expect(apply('purifying-salt', 'ghost', 9)).toEqual({ numerator: 1, denominator: 2 });
  });

  it('models both unconditional Dry Skin modifiers', () => {
    expect(apply('dry-skin', 'water')).toEqual({ numerator: 0, denominator: 1 });
    expect(apply('dry-skin', 'fire', 9, weak)).toEqual({ numerator: 5, denominator: 2 });
    expect(formatMultiplier(apply('dry-skin', 'fire', 9, weak))).toBe('2½×');
  });

  it.each(['filter', 'solid-rock', 'prism-armor'])('%s reduces only super-effective damage', (ability) => {
    expect(apply(ability, 'water', 9, weak)).toEqual({ numerator: 3, denominator: 2 });
    expect(apply(ability, 'normal')).toEqual(neutral);
  });

  it('lets Wonder Guard pass weaknesses and block neutral or resisted damage', () => {
    expect(apply('wonder-guard', 'fire', 9, weak)).toEqual(weak);
    expect(apply('wonder-guard', 'normal')).toEqual({ numerator: 0, denominator: 1 });
    expect(apply('wonder-guard', 'grass', 9, { numerator: 1, denominator: 2 })).toEqual({ numerator: 0, denominator: 1 });
  });

  it('applies Fluffy’s type-based effect and marks its contact effect as partial', () => {
    expect(abilitySupport('fluffy')).toBe('partially_supported');
    expect(apply('fluffy', 'fire')).toEqual({ numerator: 2, denominator: 1 });
  });

  it('identifies conditional effects without applying incomplete assumptions', () => {
    expect(abilitySupport('levitate')).toBe('supported');
    expect(abilitySupport('overgrow')).toBe('not_applicable');
  });
});
