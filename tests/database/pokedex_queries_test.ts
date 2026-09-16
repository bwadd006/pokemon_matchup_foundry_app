import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  datasetInformation,
  listGenerations,
  listPokedexRows,
  listTypes,
} from '../../src/main/database/pokedex_queries';
import { databasePath } from '../../scripts/database/source_data';
import { STANDARD_TYPE_DISPLAY_ORDER } from '../../src/shared/type_order';

describe('Pokédex database queries', () => {
  let database: Database.Database;

  beforeAll(() => {
    database = new Database(databasePath(), {
      readonly: true,
      fileMustExist: true,
    });
  });

  afterAll(() => database.close());

  it('lists nine generations with the newest first', () => {
    const generations = listGenerations(database);
    expect(generations).toHaveLength(9);
    expect(generations[0]?.id).toBe(9);
    expect(generations.at(-1)?.id).toBe(1);
  });

  it('uses the Generation I type set', () => {
    const types = listTypes(database, 1).map((type) => type.identifier);
    expect(types).toEqual(
      STANDARD_TYPE_DISPLAY_ORDER.filter(
        (identifier) => !['dark', 'steel', 'fairy'].includes(identifier),
      ),
    );
  });

  it('returns Generation I rows with Special and no abilities', () => {
    const rows = listPokedexRows(database, 1);
    const standardRows = rows.filter((row) => row.category === 'standard');
    expect(standardRows).toHaveLength(151);

    const bulbasaur = standardRows.find((row) => row.identifier === 'bulbasaur');
    expect(bulbasaur).toMatchObject({
      nationalDexNumber: 1,
      special: 65,
      specialAttack: null,
      specialDefense: null,
      abilityOne: null,
      hiddenAbility: null,
      bst: 253,
    });
  });

  it('changes Clefairy from Normal to Fairy in Generation VI', () => {
    const genFive = listPokedexRows(database, 5).find(
      (row) => row.identifier === 'clefairy',
    );
    const genSix = listPokedexRows(database, 6).find(
      (row) => row.identifier === 'clefairy',
    );
    expect(genFive?.typeOneIdentifier).toBe('normal');
    expect(genSix?.typeOneIdentifier).toBe('fairy');
  });

  it('reports a validated dataset', () => {
    expect(datasetInformation(database).validationStatus).toBe('passed');
  });
});
