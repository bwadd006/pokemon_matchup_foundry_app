import fs from 'node:fs';

import Database from 'better-sqlite3';

import { databasePath } from './source_data';

interface CountRow {
  count: number;
}

interface IntegrityRow {
  integrity_check: string;
}

function scalar(database: Database.Database, sql: string, ...parameters: unknown[]): number {
  return (database.prepare(sql).get(...parameters) as CountRow).count;
}

function check(name: string, condition: boolean, detail: string): void {
  if (!condition) throw new Error(`FAILED: ${name}: ${detail}`);
  console.log(`PASS  ${name}: ${detail}`);
}

const path = databasePath();
if (!fs.existsSync(path)) {
  throw new Error(`Database does not exist: ${path}`);
}

const database = new Database(path, { readonly: false, fileMustExist: true });
database.pragma('foreign_keys = ON');

try {
  const integrity = database.pragma('integrity_check') as IntegrityRow[];
  check(
    'SQLite integrity',
    integrity.length === 1 && integrity[0]?.integrity_check === 'ok',
    integrity.map((entry) => entry.integrity_check).join(', '),
  );

  const foreignKeys = database.pragma('foreign_key_check') as unknown[];
  check('Foreign keys', foreignKeys.length === 0, `${foreignKeys.length} violations`);

  const generationOneSpecies = scalar(
    database,
    'SELECT COUNT(*) AS count FROM pokemon_species WHERE introduced_generation_id <= 1',
  );
  check('Generation I species', generationOneSpecies === 151, `${generationOneSpecies} species`);

  const prematureSpecies = scalar(
    database,
    'SELECT COUNT(*) AS count FROM form_generations fg JOIN pokemon_forms pf ON pf.id = fg.form_id JOIN pokemon_species ps ON ps.id = pf.species_id WHERE fg.generation_id < ps.introduced_generation_id',
  );
  check('Species introduction', prematureSpecies === 0, `${prematureSpecies} premature rows`);

  const genOneInvalidStats = scalar(
    database,
    'SELECT COUNT(*) AS count FROM form_stats WHERE generation_id = 1 AND stat_id IN (4, 5)',
  );
  const genOneSpecial = scalar(
    database,
    'SELECT COUNT(*) AS count FROM form_stats WHERE generation_id = 1 AND stat_id = 9',
  );
  check(
    'Generation I Special',
    genOneInvalidStats === 0 && genOneSpecial > 0,
    `${genOneSpecial} Special rows; ${genOneInvalidStats} split Special rows`,
  );

  const earlyAbilities = scalar(
    database,
    'SELECT COUNT(*) AS count FROM form_abilities WHERE generation_id < 3',
  );
  check('Ability introduction', earlyAbilities === 0, `${earlyAbilities} early assignments`);

  const earlyHiddenAbilities = scalar(
    database,
    'SELECT COUNT(*) AS count FROM form_abilities WHERE generation_id < 5 AND is_hidden = 1',
  );
  check(
    'Hidden Ability introduction',
    earlyHiddenAbilities === 0,
    `${earlyHiddenAbilities} early assignments`,
  );

  const incompleteMatrices = scalar(
    database,
    'SELECT COUNT(*) AS count FROM type_chart_rulesets r WHERE (SELECT COUNT(*) FROM type_effectiveness te WHERE te.ruleset_id = r.id) != (SELECT COUNT(*) FROM ruleset_types rt WHERE rt.ruleset_id = r.id) * (SELECT COUNT(*) FROM ruleset_types rt WHERE rt.ruleset_id = r.id)',
  );
  check('Complete type matrices', incompleteMatrices === 0, `${incompleteMatrices} incomplete rulesets`);

  const clefairyGenFive = database.prepare(
    "SELECT t.identifier FROM pokemon_forms pf JOIN form_types ft ON ft.form_id = pf.id JOIN types t ON t.id = ft.type_id WHERE pf.identifier = 'clefairy' AND ft.generation_id = 5",
  ).all() as Array<{ identifier: string }>;
  const clefairyGenSix = database.prepare(
    "SELECT t.identifier FROM pokemon_forms pf JOIN form_types ft ON ft.form_id = pf.id JOIN types t ON t.id = ft.type_id WHERE pf.identifier = 'clefairy' AND ft.generation_id = 6",
  ).all() as Array<{ identifier: string }>;
  check(
    'Historical type change',
    clefairyGenFive.some((entry) => entry.identifier === 'normal') &&
      clefairyGenSix.some((entry) => entry.identifier === 'fairy'),
    `Clefairy Gen V=${clefairyGenFive.map((entry) => entry.identifier).join('/')} Gen VI=${clefairyGenSix.map((entry) => entry.identifier).join('/')}`,
  );

  const gengarGenSix = database.prepare(
    "SELECT a.identifier FROM pokemon_forms pf JOIN form_abilities fa ON fa.form_id = pf.id JOIN abilities a ON a.id = fa.ability_id WHERE pf.identifier = 'gengar' AND fa.generation_id = 6",
  ).all() as Array<{ identifier: string }>;
  const gengarGenSeven = database.prepare(
    "SELECT a.identifier FROM pokemon_forms pf JOIN form_abilities fa ON fa.form_id = pf.id JOIN abilities a ON a.id = fa.ability_id WHERE pf.identifier = 'gengar' AND fa.generation_id = 7",
  ).all() as Array<{ identifier: string }>;
  check(
    'Historical ability change',
    gengarGenSix.some((entry) => entry.identifier === 'levitate') &&
      gengarGenSeven.some((entry) => entry.identifier === 'cursed-body'),
    `Gengar Gen VI=${gengarGenSix.map((entry) => entry.identifier).join('/')} Gen VII=${gengarGenSeven.map((entry) => entry.identifier).join('/')}`,
  );

  const raichuSpeedGenFive = scalar(
    database,
    "SELECT fs.base_value AS count FROM pokemon_forms pf JOIN form_stats fs ON fs.form_id = pf.id WHERE pf.identifier = 'raichu' AND fs.generation_id = 5 AND fs.stat_id = 6",
  );
  const raichuSpeedGenSix = scalar(
    database,
    "SELECT fs.base_value AS count FROM pokemon_forms pf JOIN form_stats fs ON fs.form_id = pf.id WHERE pf.identifier = 'raichu' AND fs.generation_id = 6 AND fs.stat_id = 6",
  );
  check(
    'Historical stat change',
    raichuSpeedGenFive === 100 && raichuSpeedGenSix === 110,
    `Raichu Speed Gen V=${raichuSpeedGenFive} Gen VI=${raichuSpeedGenSix}`,
  );

  const alolanRattataEarly = scalar(
    database,
    "SELECT COUNT(*) AS count FROM pokemon_forms pf JOIN form_generations fg ON fg.form_id = pf.id WHERE pf.identifier = 'rattata-alola' AND fg.generation_id < 7",
  );
  const alolanRattataGenSeven = scalar(
    database,
    "SELECT COUNT(*) AS count FROM pokemon_forms pf JOIN form_generations fg ON fg.form_id = pf.id WHERE pf.identifier = 'rattata-alola' AND fg.generation_id = 7",
  );
  check(
    'Historical form introduction',
    alolanRattataEarly === 0 && alolanRattataGenSeven === 1,
    `early=${alolanRattataEarly} Gen VII=${alolanRattataGenSeven}`,
  );

  const counts = {
    generations: scalar(database, 'SELECT COUNT(*) AS count FROM generations'),
    species: scalar(database, 'SELECT COUNT(*) AS count FROM pokemon_species'),
    forms: scalar(database, 'SELECT COUNT(*) AS count FROM pokemon_forms'),
    abilities: scalar(database, 'SELECT COUNT(*) AS count FROM abilities'),
    types: scalar(database, 'SELECT COUNT(*) AS count FROM types'),
    imageReferences: scalar(database, 'SELECT COUNT(*) AS count FROM image_assets WHERE source_url IS NOT NULL'),
    typeRulesets: scalar(database, 'SELECT COUNT(*) AS count FROM type_chart_rulesets'),
  };

  database.prepare(
    "UPDATE dataset_builds SET validation_status = 'passed' WHERE id = (SELECT MAX(id) FROM dataset_builds)",
  ).run();

  console.log('\nDatabase summary');
  console.table(counts);
  console.log('Validation completed successfully.');
} catch (error) {
  database.prepare(
    "UPDATE dataset_builds SET validation_status = 'failed' WHERE id = (SELECT MAX(id) FROM dataset_builds)",
  ).run();
  throw error;
} finally {
  database.close();
}
