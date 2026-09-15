import type Database from 'better-sqlite3';

import type {
  TeamAbility,
  TeamPokemonOption,
} from '../../shared/models/team';

interface RawTeamPokemonRow {
  form_id: number;
  pokemon_id: number;
  national_dex_number: number;
  identifier: string;
  name: string;
  category: TeamPokemonOption['category'];
  image_path: string | null;
  type_one_id: number;
  type_one_identifier: string;
  type_one_name: string;
  type_two_id: number | null;
  type_two_identifier: string | null;
  type_two_name: string | null;
  ability_id: number | null;
  ability_identifier: string | null;
  ability_name: string | null;
  ability_slot: number | null;
  ability_is_hidden: number | null;
}

export function listTeamPokemonOptions(
  database: Database.Database,
  generationId: number,
): TeamPokemonOption[] {
  const rows = database
    .prepare(
      `
      WITH type_values AS (
        SELECT
          ft.form_id,
          MAX(CASE WHEN ft.slot = 1 THEN t.id END) AS type_one_id,
          MAX(CASE WHEN ft.slot = 1 THEN t.identifier END) AS type_one_identifier,
          MAX(CASE WHEN ft.slot = 1 THEN t.name END) AS type_one_name,
          MAX(CASE WHEN ft.slot = 2 THEN t.id END) AS type_two_id,
          MAX(CASE WHEN ft.slot = 2 THEN t.identifier END) AS type_two_identifier,
          MAX(CASE WHEN ft.slot = 2 THEN t.name END) AS type_two_name
        FROM form_types ft
        JOIN types t ON t.id = ft.type_id
        WHERE ft.generation_id = ?
        GROUP BY ft.form_id
      )
      SELECT
        pf.id AS form_id,
        pf.pokemon_id,
        ps.national_dex_number,
        pf.identifier,
        pf.name,
        fc.identifier AS category,
        ia.relative_path AS image_path,
        tv.type_one_id,
        tv.type_one_identifier,
        tv.type_one_name,
        tv.type_two_id,
        tv.type_two_identifier,
        tv.type_two_name,
        a.id AS ability_id,
        a.identifier AS ability_identifier,
        a.name AS ability_name,
        fa.slot AS ability_slot,
        fa.is_hidden AS ability_is_hidden
      FROM form_generations fg
      JOIN pokemon_forms pf ON pf.id = fg.form_id
      JOIN pokemon_species ps ON ps.id = pf.species_id
      JOIN form_categories fc ON fc.id = pf.category_id
      JOIN type_values tv ON tv.form_id = pf.id
      LEFT JOIN form_abilities fa
        ON fa.form_id = pf.id
       AND fa.generation_id = fg.generation_id
      LEFT JOIN abilities a ON a.id = fa.ability_id
      LEFT JOIN image_assets ia ON ia.form_id = pf.id
      WHERE fg.generation_id = ?
        AND fc.identifier != 'cosmetic'
      ORDER BY ps.national_dex_number, pf.sort_order, pf.form_order, pf.id, fa.slot
      `,
    )
    .all(generationId, generationId) as RawTeamPokemonRow[];

  const options = new Map<number, TeamPokemonOption>();
  for (const row of rows) {
    let option = options.get(row.form_id);
    if (!option) {
      option = {
        formId: row.form_id,
        pokemonId: row.pokemon_id,
        nationalDexNumber: row.national_dex_number,
        identifier: row.identifier,
        name: row.name,
        category: row.category,
        imagePath: row.image_path,
        types: [
          {
            id: row.type_one_id,
            identifier: row.type_one_identifier,
            name: row.type_one_name,
          },
          ...(row.type_two_id && row.type_two_identifier && row.type_two_name
            ? [{
                id: row.type_two_id,
                identifier: row.type_two_identifier,
                name: row.type_two_name,
              }]
            : []),
        ],
        abilities: [],
      };
      options.set(row.form_id, option);
    }

    if (
      row.ability_id &&
      row.ability_identifier &&
      row.ability_name &&
      row.ability_slot
    ) {
      const ability: TeamAbility = {
        id: row.ability_id,
        identifier: row.ability_identifier,
        name: row.ability_name,
        slot: row.ability_slot,
        isHidden: row.ability_is_hidden === 1,
      };
      option.abilities.push(ability);
    }
  }

  return [...options.values()];
}
