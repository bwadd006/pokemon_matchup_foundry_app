import type Database from 'better-sqlite3';

import type { PokemonType } from '../../shared/models/pokedex';
import type {
  TypeChart,
  TypeChartMatchup,
} from '../../shared/models/type_effectiveness';

interface RawTypeChartMatchup {
  attacking_type_id: number;
  defending_type_id: number;
  numerator: number;
  denominator: number;
}

export function getTypeChart(
  database: Database.Database,
  generationId: number,
): TypeChart {
  const ruleset = database
    .prepare(
      `
      SELECT r.id, r.identifier
      FROM generation_type_chart_rulesets gtr
      JOIN type_chart_rulesets r ON r.id = gtr.ruleset_id
      WHERE gtr.generation_id = ?
      `,
    )
    .get(generationId) as { id: number; identifier: string } | undefined;

  if (!ruleset) {
    throw new Error(`No type chart is available for Generation ${generationId}.`);
  }

  const types = database
    .prepare(
      `
      SELECT t.id, t.identifier, t.name
      FROM ruleset_types rt
      JOIN types t ON t.id = rt.type_id
      WHERE rt.ruleset_id = ?
      ORDER BY rt.display_order
      `,
    )
    .all(ruleset.id) as PokemonType[];

  const rawMatchups = database
    .prepare(
      `
      SELECT
        te.attacking_type_id,
        te.defending_type_id,
        te.numerator,
        te.denominator
      FROM type_effectiveness te
      JOIN ruleset_types attacking
        ON attacking.ruleset_id = te.ruleset_id
       AND attacking.type_id = te.attacking_type_id
      JOIN ruleset_types defending
        ON defending.ruleset_id = te.ruleset_id
       AND defending.type_id = te.defending_type_id
      WHERE te.ruleset_id = ?
      ORDER BY attacking.display_order, defending.display_order
      `,
    )
    .all(ruleset.id) as RawTypeChartMatchup[];

  const matchups: TypeChartMatchup[] = rawMatchups.map((matchup) => ({
    attackingTypeId: matchup.attacking_type_id,
    defendingTypeId: matchup.defending_type_id,
    numerator: matchup.numerator,
    denominator: matchup.denominator,
  }));

  if (matchups.length !== types.length * types.length) {
    throw new Error(`The Generation ${generationId} type chart is incomplete.`);
  }

  return {
    generationId,
    rulesetIdentifier: ruleset.identifier,
    types,
    matchups,
  };
}
