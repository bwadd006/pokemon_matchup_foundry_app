import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databasePath } from '../../scripts/database/source_data';
import { getTypeChart } from '../../src/main/database/type_chart_queries';
import type { TypeChart } from '../../src/shared/models/type_effectiveness';

function multiplier(
  chart: TypeChart,
  attackingIdentifier: string,
  defendingIdentifier: string,
) {
  const attacking = chart.types.find(
    (type) => type.identifier === attackingIdentifier,
  );
  const defending = chart.types.find(
    (type) => type.identifier === defendingIdentifier,
  );
  return chart.matchups.find(
    (entry) =>
      entry.attackingTypeId === attacking?.id &&
      entry.defendingTypeId === defending?.id,
  );
}

describe('Type chart database query', () => {
  let database: Database.Database;

  beforeAll(() => {
    database = new Database(databasePath(), {
      readonly: true,
      fileMustExist: true,
    });
  });

  afterAll(() => database.close());

  it.each([
    [1, 15, 225],
    [2, 17, 289],
    [5, 17, 289],
    [6, 18, 324],
    [9, 18, 324],
  ])(
    'returns a complete Generation %i matrix',
    (generationId, typeCount, matchupCount) => {
      const chart = getTypeChart(database, generationId);
      expect(chart.types).toHaveLength(typeCount);
      expect(chart.matchups).toHaveLength(matchupCount);
    },
  );

  it('returns weakness, resistance, immunity, and neutral values', () => {
    const chart = getTypeChart(database, 9);
    expect(multiplier(chart, 'fire', 'grass')).toMatchObject({
      numerator: 2,
      denominator: 1,
    });
    expect(multiplier(chart, 'fire', 'water')).toMatchObject({
      numerator: 1,
      denominator: 2,
    });
    expect(multiplier(chart, 'normal', 'ghost')).toMatchObject({
      numerator: 0,
      denominator: 1,
    });
    expect(multiplier(chart, 'normal', 'normal')).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
  });

  it('preserves Generation I matchup rules', () => {
    const chart = getTypeChart(database, 1);
    expect(multiplier(chart, 'ghost', 'psychic')).toMatchObject({
      numerator: 0,
      denominator: 1,
    });
    expect(multiplier(chart, 'bug', 'poison')).toMatchObject({
      numerator: 2,
      denominator: 1,
    });
  });

  it('rejects an unknown generation', () => {
    expect(() => getTypeChart(database, 99)).toThrow(
      'No type chart is available for Generation 99.',
    );
  });
});
