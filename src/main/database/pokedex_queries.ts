import type Database from 'better-sqlite3';

import type {
  DatasetInformation,
  Generation,
  PokedexRow,
  PokemonType,
} from '../../shared/models/pokedex';

interface RawPokedexRow {
  national_dex_number: number;
  form_id: number;
  pokemon_id: number;
  identifier: string;
  name: string;
  category: PokedexRow['category'];
  type_one: string | null;
  type_one_identifier: string | null;
  type_two: string | null;
  type_two_identifier: string | null;
  hp: number | null;
  attack: number | null;
  defense: number | null;
  special: number | null;
  special_attack: number | null;
  special_defense: number | null;
  speed: number | null;
  bst: number;
  ability_one: string | null;
  ability_two: string | null;
  hidden_ability: string | null;
  image_path: string | null;
  image_kind: string | null;
}

export function listGenerations(database: Database.Database): Generation[] {
  return database
    .prepare(
      'SELECT id, identifier, name FROM generations ORDER BY id DESC',
    )
    .all() as Generation[];
}

export function listTypes(
  database: Database.Database,
  generationId: number,
): PokemonType[] {
  return database
    .prepare(
      'SELECT t.id, t.identifier, t.name FROM generation_types gt JOIN types t ON t.id = gt.type_id WHERE gt.generation_id = ? ORDER BY gt.display_order',
    )
    .all(generationId) as PokemonType[];
}

export function listPokedexRows(
  database: Database.Database,
  generationId: number,
): PokedexRow[] {
  const rows = database
    .prepare(
      `
      WITH type_values AS (
        SELECT
          ft.form_id,
          MAX(CASE WHEN ft.slot = 1 THEN t.name END) AS type_one,
          MAX(CASE WHEN ft.slot = 1 THEN t.identifier END) AS type_one_identifier,
          MAX(CASE WHEN ft.slot = 2 THEN t.name END) AS type_two,
          MAX(CASE WHEN ft.slot = 2 THEN t.identifier END) AS type_two_identifier
        FROM form_types ft
        JOIN types t ON t.id = ft.type_id
        WHERE ft.generation_id = ?
        GROUP BY ft.form_id
      ),
      stat_values AS (
        SELECT
          fs.form_id,
          MAX(CASE WHEN fs.stat_id = 1 THEN fs.base_value END) AS hp,
          MAX(CASE WHEN fs.stat_id = 2 THEN fs.base_value END) AS attack,
          MAX(CASE WHEN fs.stat_id = 3 THEN fs.base_value END) AS defense,
          MAX(CASE WHEN fs.stat_id = 9 THEN fs.base_value END) AS special,
          MAX(CASE WHEN fs.stat_id = 4 THEN fs.base_value END) AS special_attack,
          MAX(CASE WHEN fs.stat_id = 5 THEN fs.base_value END) AS special_defense,
          MAX(CASE WHEN fs.stat_id = 6 THEN fs.base_value END) AS speed,
          SUM(fs.base_value) AS bst
        FROM form_stats fs
        WHERE fs.generation_id = ?
        GROUP BY fs.form_id
      ),
      ability_values AS (
        SELECT
          fa.form_id,
          MAX(CASE WHEN fa.is_hidden = 0 AND fa.slot = 1 THEN a.name END) AS ability_one,
          MAX(CASE WHEN fa.is_hidden = 0 AND fa.slot = 2 THEN a.name END) AS ability_two,
          MAX(CASE WHEN fa.is_hidden = 1 THEN a.name END) AS hidden_ability
        FROM form_abilities fa
        JOIN abilities a ON a.id = fa.ability_id
        WHERE fa.generation_id = ?
        GROUP BY fa.form_id
      )
      SELECT
        ps.national_dex_number,
        pf.id AS form_id,
        pf.pokemon_id,
        pf.identifier,
        pf.name,
        fc.identifier AS category,
        tv.type_one,
        tv.type_one_identifier,
        tv.type_two,
        tv.type_two_identifier,
        sv.hp,
        sv.attack,
        sv.defense,
        sv.special,
        sv.special_attack,
        sv.special_defense,
        sv.speed,
        sv.bst,
        av.ability_one,
        av.ability_two,
        av.hidden_ability,
        ia.relative_path AS image_path,
        ia.kind AS image_kind
      FROM form_generations fg
      JOIN pokemon_forms pf ON pf.id = fg.form_id
      JOIN pokemon_species ps ON ps.id = pf.species_id
      JOIN form_categories fc ON fc.id = pf.category_id
      JOIN type_values tv ON tv.form_id = pf.id
      JOIN stat_values sv ON sv.form_id = pf.id
      LEFT JOIN ability_values av ON av.form_id = pf.id
      LEFT JOIN image_assets ia ON ia.form_id = pf.id
      WHERE fg.generation_id = ?
      ORDER BY
        ps.national_dex_number,
        CASE fc.identifier
          WHEN 'standard' THEN 1
          WHEN 'cosmetic' THEN 2
          WHEN 'transformation' THEN 3
          WHEN 'battle_only' THEN 4
        END,
        pf.sort_order,
        pf.form_order,
        pf.id
      `,
    )
    .all(generationId, generationId, generationId, generationId) as RawPokedexRow[];

  return rows.map((row) => ({
    nationalDexNumber: row.national_dex_number,
    formId: row.form_id,
    pokemonId: row.pokemon_id,
    identifier: row.identifier,
    name: row.name,
    category: row.category,
    typeOne: row.type_one,
    typeOneIdentifier: row.type_one_identifier,
    typeTwo: row.type_two,
    typeTwoIdentifier: row.type_two_identifier,
    hp: row.hp,
    attack: row.attack,
    defense: row.defense,
    special: row.special,
    specialAttack: row.special_attack,
    specialDefense: row.special_defense,
    speed: row.speed,
    bst: row.bst,
    abilityOne: row.ability_one,
    abilityTwo: row.ability_two,
    hiddenAbility: row.hidden_ability,
    imagePath: row.image_path,
    imageKind: row.image_kind,
  }));
}

export function datasetInformation(
  database: Database.Database,
): DatasetInformation {
  const row = database
    .prepare(
      'SELECT schema_version, built_at, source_commit, validation_status FROM dataset_builds ORDER BY id DESC LIMIT 1',
    )
    .get() as {
      schema_version: number;
      built_at: string;
      source_commit: string;
      validation_status: DatasetInformation['validationStatus'];
    };

  return {
    schemaVersion: row.schema_version,
    builtAt: row.built_at,
    sourceCommit: row.source_commit,
    validationStatus: row.validation_status,
  };
}
