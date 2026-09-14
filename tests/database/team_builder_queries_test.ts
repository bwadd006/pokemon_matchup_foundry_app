import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databasePath } from '../../scripts/database/source_data';
import { listTeamBuilderOptions } from '../../src/main/database/team_builder_queries';

describe('Team Builder database queries', () => {
  let database: Database.Database;

  beforeAll(() => {
    database = new Database(databasePath(), {
      readonly: true,
      fileMustExist: true,
    });
  });

  afterAll(() => database.close());

  it('returns only battle-relevant forms', () => {
    const options = listTeamBuilderOptions(database, 9);
    expect(options.length).toBeGreaterThan(1000);
    expect(options.every((option) => option.category !== ('cosmetic' as never))).toBe(true);
    expect(options.some((option) => option.category === 'transformation')).toBe(true);
    expect(options.some((option) => option.category === 'battle_only')).toBe(true);
  });

  it('returns current types and abilities for a selectable Pokémon', () => {
    const charizard = listTeamBuilderOptions(database, 9).find(
      (option) => option.identifier === 'charizard',
    );
    expect(charizard?.types.map((type) => type.identifier)).toEqual([
      'fire',
      'flying',
    ]);
    expect(charizard?.abilities.map((ability) => ability.identifier)).toEqual([
      'blaze',
      'solar-power',
    ]);
    expect(charizard?.abilities[1]?.isHidden).toBe(true);
    expect(charizard?.imagePath).toBeTruthy();
  });

  it('returns no ability choices in Generation I', () => {
    const bulbasaur = listTeamBuilderOptions(database, 1).find(
      (option) => option.identifier === 'bulbasaur',
    );
    expect(bulbasaur?.abilities).toEqual([]);
  });
});
