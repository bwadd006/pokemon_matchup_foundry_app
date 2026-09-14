import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databasePath } from '../../scripts/database/source_data';
import { getTypeChart } from '../../src/main/database/type_chart_queries';
import {
  attackingAbilitySupport,
  calculateTeamMatchupMultiplier,
} from '../../src/shared/mechanics/team_matchup';
import type { TeamMemberSelection } from '../../src/shared/models/team';
import type { TypeChart } from '../../src/shared/models/type_effectiveness';

function member(
  chart: TypeChart,
  typeIdentifiers: string[],
  abilityIdentifier: string | null = null,
): TeamMemberSelection {
  return {
    formId: 1,
    pokemonId: 1,
    nationalDexNumber: 1,
    identifier: 'test',
    name: 'Test Pokémon',
    imagePath: null,
    types: typeIdentifiers.map((identifier) => chart.types.find((type) => type.identifier === identifier)!),
    ability: abilityIdentifier ? {
      id: 1,
      identifier: abilityIdentifier,
      name: abilityIdentifier,
      slot: 1,
      isHidden: false,
    } : null,
    attackingTypeIdentifiers: [],
  };
}

function matchup(
  chart: TypeChart,
  attackingType: string,
  attackerAbility: string | null,
  defenderTypes: string[],
  defenderAbility: string | null = null,
) {
  const type = chart.types.find((entry) => entry.identifier === attackingType)!;
  return calculateTeamMatchupMultiplier(
    chart,
    type.id,
    member(chart, ['normal'], attackerAbility),
    member(chart, defenderTypes, defenderAbility),
  );
}

describe('two-sided Team Matchup mechanics', () => {
  let database: Database.Database;

  beforeAll(() => {
    database = new Database(databasePath(), { readonly: true, fileMustExist: true });
  });

  afterAll(() => database.close());

  it('lets Scrappy bypass only the Ghost component of an immunity', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'normal', null, ['ghost', 'rock'])).toEqual({ numerator: 0, denominator: 1 });
    expect(matchup(chart, 'normal', 'scrappy', ['ghost', 'rock'])).toEqual({ numerator: 1, denominator: 2 });
    expect(matchup(chart, 'fighting', 'minds-eye', ['ghost', 'dark'])).toEqual({ numerator: 2, denominator: 1 });
  });

  it('uses the generation in which Scrappy was introduced', () => {
    const chart = getTypeChart(database, 3);
    expect(matchup(chart, 'normal', 'scrappy', ['ghost'])).toEqual({ numerator: 0, denominator: 1 });
  });

  it('lets Mold Breaker-family abilities ignore breakable defender abilities', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'ground', null, ['electric'], 'levitate')).toEqual({ numerator: 0, denominator: 1 });
    expect(matchup(chart, 'ground', 'mold-breaker', ['electric'], 'levitate')).toEqual({ numerator: 2, denominator: 1 });
    expect(matchup(chart, 'fire', 'teravolt', ['normal'], 'fluffy')).toEqual({ numerator: 1, denominator: 1 });
  });

  it('does not let Mold Breaker ignore Prism Armor', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'dark', 'mold-breaker', ['psychic'], 'prism-armor')).toEqual({ numerator: 3, denominator: 2 });
  });

  it('applies Tinted Lens only to resisted type matchups', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'bug', 'tinted-lens', ['fire', 'flying'])).toEqual({ numerator: 1, denominator: 2 });
    expect(matchup(chart, 'normal', 'tinted-lens', ['ghost'])).toEqual({ numerator: 0, denominator: 1 });
  });

  it('applies Neuroforce after a super-effective type matchup', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'water', 'neuroforce', ['fire'])).toEqual({ numerator: 5, denominator: 2 });
  });

  it('applies unconditional final-type power abilities', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'water', 'water-bubble', ['fire'])).toEqual({ numerator: 4, denominator: 1 });
    expect(matchup(chart, 'steel', 'steelworker', ['fairy'])).toEqual({ numerator: 3, denominator: 1 });
    expect(matchup(chart, 'dragon', 'dragons-maw', ['dragon'])).toEqual({ numerator: 3, denominator: 1 });
    expect(matchup(chart, 'rock', 'rocky-payload', ['flying'])).toEqual({ numerator: 3, denominator: 1 });
  });

  it('uses the historical Transistor multiplier', () => {
    const genEight = getTypeChart(database, 8);
    const genNine = getTypeChart(database, 9);
    expect(matchup(genEight, 'electric', 'transistor', ['water'])).toEqual({ numerator: 3, denominator: 1 });
    expect(matchup(genNine, 'electric', 'transistor', ['water'])).toEqual({ numerator: 13, denominator: 5 });
  });

  it('applies aura abilities from either side and Aura Break', () => {
    const chart = getTypeChart(database, 9);
    expect(matchup(chart, 'dark', 'dark-aura', ['normal'])).toEqual({ numerator: 4, denominator: 3 });
    expect(matchup(chart, 'dark', null, ['normal'], 'dark-aura')).toEqual({ numerator: 4, denominator: 3 });
    expect(matchup(chart, 'dark', 'dark-aura', ['normal'], 'aura-break')).toEqual({ numerator: 3, denominator: 4 });
  });

  it('classifies deterministic and conditional attacking abilities', () => {
    expect(attackingAbilitySupport('mold-breaker')).toBe('supported');
    expect(attackingAbilitySupport('tinted-lens')).toBe('supported');
    expect(attackingAbilitySupport('blaze')).toBe('conditional_unmodeled');
    expect(attackingAbilitySupport('overcoat')).toBe('not_applicable');
  });
});
