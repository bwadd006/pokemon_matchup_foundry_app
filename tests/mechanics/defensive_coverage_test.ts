import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databasePath } from '../../scripts/database/source_data';
import { getTypeChart } from '../../src/main/database/type_chart_queries';
import { listTeamPokemonOptions } from '../../src/main/database/team_pokemon_queries';
import { calculateDefensiveCoverageMultiplier } from '../../src/shared/mechanics/defensive_coverage';
import type { TeamMemberSelection, TeamPokemonOption } from '../../src/shared/models/team';

function select(option: TeamPokemonOption, abilityIdentifier: string | null = null): TeamMemberSelection {
  return {
    formId: option.formId,
    pokemonId: option.pokemonId,
    nationalDexNumber: option.nationalDexNumber,
    identifier: option.identifier,
    name: option.name,
    imagePath: option.imagePath,
    types: option.types,
    ability: option.abilities.find((ability) => ability.identifier === abilityIdentifier) ?? null,
    attackingTypeIdentifiers: [],
  };
}

describe('Defensive Coverage calculations', () => {
  let database: Database.Database;

  beforeAll(() => {
    database = new Database(databasePath(), { readonly: true, fileMustExist: true });
  });

  afterAll(() => database.close());

  it('combines both of Charizard’s types', () => {
    const chart = getTypeChart(database, 9);
    const charizard = listTeamPokemonOptions(database, 9).find(
      (option) => option.identifier === 'charizard',
    )!;
    const rock = chart.types.find((type) => type.identifier === 'rock')!;
    const ground = chart.types.find((type) => type.identifier === 'ground')!;

    expect(calculateDefensiveCoverageMultiplier(chart, rock.id, select(charizard))).toEqual({ numerator: 4, denominator: 1 });
    expect(calculateDefensiveCoverageMultiplier(chart, ground.id, select(charizard))).toEqual({ numerator: 0, denominator: 1 });
  });

  it('applies the selected ability after dual-type effectiveness', () => {
    const chart = getTypeChart(database, 4);
    const gengar = listTeamPokemonOptions(database, 4).find(
      (option) => option.identifier === 'gengar',
    )!;
    const ground = chart.types.find((type) => type.identifier === 'ground')!;

    expect(calculateDefensiveCoverageMultiplier(chart, ground.id, select(gengar))).toEqual({ numerator: 2, denominator: 1 });
    expect(calculateDefensiveCoverageMultiplier(chart, ground.id, select(gengar, 'levitate'))).toEqual({ numerator: 0, denominator: 1 });
  });
});
