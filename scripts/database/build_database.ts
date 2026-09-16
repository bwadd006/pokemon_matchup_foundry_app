import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { typeDisplayOrder } from '../../src/shared/type_order';

import {
  databasePath,
  englishName,
  humanizeIdentifier,
  projectRoot,
  readManifest,
  readResources,
  resourceId,
  sourceRoot,
  type NamedResource,
} from './source_data';

interface NameEntry {
  name: string;
  language: NamedResource;
}

interface GenerationData {
  id: number;
  name: string;
  names: NameEntry[];
}

interface TypeRelations {
  no_damage_to: NamedResource[];
  half_damage_to: NamedResource[];
  double_damage_to: NamedResource[];
}

interface TypeData {
  id: number;
  name: string;
  names: NameEntry[];
  generation: NamedResource;
  damage_relations: TypeRelations;
  past_damage_relations: Array<{
    generation: NamedResource;
    damage_relations: TypeRelations;
  }>;
}

interface AbilityData {
  id: number;
  name: string;
  names: NameEntry[];
  generation: NamedResource;
}

interface StatValue {
  base_stat: number;
  stat: NamedResource;
}

interface AbilityValue {
  ability: NamedResource | null;
  is_hidden: boolean;
  slot: number;
}

interface TypeValue {
  slot: number;
  type: NamedResource;
}

interface PokemonData {
  id: number;
  name: string;
  order: number;
  is_default: boolean;
  species: NamedResource;
  forms: NamedResource[];
  types: TypeValue[];
  stats: StatValue[];
  abilities: AbilityValue[];
  past_types: Array<{ generation: NamedResource; types: TypeValue[] }>;
  past_stats: Array<{ generation: NamedResource; stats: StatValue[] }>;
  past_abilities: Array<{
    generation: NamedResource;
    abilities: AbilityValue[];
  }>;
  sprites: {
    front_default: string | null;
    other?: {
      home?: { front_default?: string | null };
      'official-artwork'?: { front_default?: string | null };
    };
  };
}

interface SpeciesData {
  id: number;
  name: string;
  names: NameEntry[];
  generation: NamedResource;
  varieties: Array<{ is_default: boolean; pokemon: NamedResource }>;
}

interface PokemonFormData {
  id: number;
  name: string;
  form_name: string;
  names: NameEntry[];
  form_names: NameEntry[];
  form_order: number;
  is_default: boolean;
  is_battle_only: boolean;
  is_mega: boolean;
  pokemon: NamedResource;
  version_group: NamedResource;
}

interface VersionGroupData {
  id: number;
  name: string;
  generation: NamedResource;
}

const STANDARD_TYPE_IDS = new Set(Array.from({ length: 18 }, (_, index) => index + 1));
const IMPORTER_VERSION = '0.1.0';
const SCHEMA_VERSION = 1;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function historyForGeneration<T>(
  current: T,
  history: Array<{ generation: NamedResource; value: T }>,
  generationId: number,
): T {
  const applicable = history
    .map((entry) => ({ maxGeneration: resourceId(entry.generation), value: entry.value }))
    .filter((entry) => entry.maxGeneration >= generationId)
    .sort((left, right) => left.maxGeneration - right.maxGeneration);
  return applicable[0]?.value ?? current;
}

function historicalTypes(pokemon: PokemonData, generationId: number): TypeValue[] {
  return historyForGeneration(
    pokemon.types,
    pokemon.past_types.map((entry) => ({
      generation: entry.generation,
      value: entry.types,
    })),
    generationId,
  );
}

function historicalStats(pokemon: PokemonData, generationId: number): Map<number, number> {
  const values = new Map(
    pokemon.stats.map((entry) => [resourceId(entry.stat), entry.base_stat]),
  );

  const candidates = new Map<number, Array<{ maxGeneration: number; value: number }>>();
  for (const history of pokemon.past_stats) {
    const maxGeneration = resourceId(history.generation);
    if (maxGeneration < generationId) continue;
    for (const stat of history.stats) {
      const statId = resourceId(stat.stat);
      const list = candidates.get(statId) ?? [];
      list.push({ maxGeneration, value: stat.base_stat });
      candidates.set(statId, list);
    }
  }

  for (const [statId, entries] of candidates) {
    entries.sort((left, right) => left.maxGeneration - right.maxGeneration);
    const first = entries[0];
    if (first) values.set(statId, first.value);
  }

  if (generationId === 1) {
    values.delete(4);
    values.delete(5);
  } else {
    values.delete(9);
  }

  return values;
}

function historicalAbilities(
  pokemon: PokemonData,
  generationId: number,
): AbilityValue[] {
  if (generationId < 3) return [];

  const slots = new Map<number, AbilityValue>();
  for (const ability of pokemon.abilities) slots.set(ability.slot, ability);

  const candidates = new Map<number, Array<{ maxGeneration: number; value: AbilityValue }>>();
  for (const history of pokemon.past_abilities) {
    const maxGeneration = resourceId(history.generation);
    if (maxGeneration < generationId) continue;
    for (const ability of history.abilities) {
      const list = candidates.get(ability.slot) ?? [];
      list.push({ maxGeneration, value: ability });
      candidates.set(ability.slot, list);
    }
  }

  for (const [slot, entries] of candidates) {
    entries.sort((left, right) => left.maxGeneration - right.maxGeneration);
    const first = entries[0];
    if (first) slots.set(slot, first.value);
  }

  return [...slots.values()]
    .filter((entry) => entry.ability !== null)
    .filter((entry) => generationId >= 5 || !entry.is_hidden)
    .sort((left, right) => left.slot - right.slot);
}

function battleSignature(pokemon: PokemonData): string {
  return JSON.stringify({
    types: pokemon.types.map((entry) => [entry.slot, resourceId(entry.type)]),
    stats: pokemon.stats.map((entry) => [resourceId(entry.stat), entry.base_stat]).sort(),
    abilities: pokemon.abilities.map((entry) => [
      entry.slot,
      entry.is_hidden,
      entry.ability ? resourceId(entry.ability) : null,
    ]),
  });
}

function relationForGeneration(type: TypeData, generationId: number): TypeRelations {
  return historyForGeneration(
    type.damage_relations,
    type.past_damage_relations.map((entry) => ({
      generation: entry.generation,
      value: entry.damage_relations,
    })),
    generationId,
  );
}

function formDisplayName(form: PokemonFormData, speciesName: string): string {
  const explicit = form.names.find((entry) => entry.language.name === 'en')?.name;
  if (explicit) return explicit;
  const formName = form.form_names.find((entry) => entry.language.name === 'en')?.name;
  if (formName) return `${speciesName} ${formName}`;
  return form.is_default ? speciesName : humanizeIdentifier(form.name);
}

function pinnedSpriteUrl(url: string, commit: string): string {
  return url.replace(
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/',
    `https://raw.githubusercontent.com/PokeAPI/sprites/${commit}/`,
  );
}

function overrideRevision(): string {
  const directory = path.join(projectRoot, 'data', 'overrides');
  const contents = fs
    .readdirSync(directory)
    .sort()
    .map((name) => fs.readFileSync(path.join(directory, name), 'utf8'))
    .join('\n');
  return sha256(contents);
}

function assertOverridesSupported(): void {
  const directory = path.join(projectRoot, 'data', 'overrides');
  for (const name of fs.readdirSync(directory)) {
    const document = JSON.parse(
      fs.readFileSync(path.join(directory, name), 'utf8'),
    ) as { overrides?: unknown[] };
    if (!Array.isArray(document.overrides)) {
      throw new Error(`${name} must contain an overrides array.`);
    }
    if (document.overrides.length > 0) {
      throw new Error(
        `${name} contains overrides, but alpha override operations are not yet defined.`,
      );
    }
  }
}

console.log(`Reading pinned source from ${sourceRoot()}`);
assertOverridesSupported();

const manifest = readManifest();
const generations = readResources<GenerationData>('generation').filter(
  (entry) => entry.id <= 9,
);
const types = readResources<TypeData>('type').filter((entry) =>
  STANDARD_TYPE_IDS.has(entry.id),
);
const abilities = readResources<AbilityData>('ability').filter(
  (entry) => resourceId(entry.generation) <= 9,
);
const species = readResources<SpeciesData>('pokemon-species').filter(
  (entry) => resourceId(entry.generation) <= 9,
);
const pokemon = readResources<PokemonData>('pokemon');
const forms = readResources<PokemonFormData>('pokemon-form');
const versionGroups = readResources<VersionGroupData>('version-group');

const pokemonById = new Map(pokemon.map((entry) => [entry.id, entry]));
const speciesById = new Map(species.map((entry) => [entry.id, entry]));
const versionGeneration = new Map(
  versionGroups.map((entry) => [entry.name, resourceId(entry.generation)]),
);
const defaultPokemonBySpecies = new Map<number, number>();
for (const entry of species) {
  const defaultVariety = entry.varieties.find((variety) => variety.is_default);
  if (defaultVariety) {
    defaultPokemonBySpecies.set(entry.id, resourceId(defaultVariety.pokemon));
  }
}

const output = databasePath();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.rmSync(output, { force: true });

const database = new Database(output);
database.pragma('foreign_keys = ON');
database.pragma('journal_mode = DELETE');
database.exec(
  fs.readFileSync(
    path.join(projectRoot, 'database', 'schema', '001_initial_schema.sql'),
    'utf8',
  ),
);

const build = database.transaction(() => {
  const insertGeneration = database.prepare(
    'INSERT INTO generations (id, identifier, name) VALUES (?, ?, ?)',
  );
  for (const generation of generations) {
    insertGeneration.run(
      generation.id,
      generation.name,
      englishName(generation.names, generation.name),
    );
  }

  const insertSource = database.prepare(
    'INSERT INTO source_references (identifier, name, url, revision, license, rights_notice) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const apiSource = manifest.sources.pokeapi_api_data;
  const spriteSource = manifest.sources.pokeapi_sprites;
  const apiSourceResult = insertSource.run(
    'pokeapi_api_data',
    'PokéAPI API Data',
    apiSource.repository,
    apiSource.commit,
    apiSource.license,
    null,
  );
  const spriteSourceResult = insertSource.run(
    'pokeapi_sprites',
    'PokéAPI Sprites',
    spriteSource.repository,
    spriteSource.commit,
    spriteSource.license,
    spriteSource.rights_notice,
  );
  const spriteSourceId = Number(spriteSourceResult.lastInsertRowid);

  const insertType = database.prepare(
    'INSERT INTO types (id, identifier, name, introduced_generation_id) VALUES (?, ?, ?, ?)',
  );
  for (const type of types) {
    insertType.run(
      type.id,
      type.name,
      englishName(type.names, type.name),
      resourceId(type.generation),
    );
  }

  const insertGenerationType = database.prepare(
    'INSERT INTO generation_types (generation_id, type_id, display_order) VALUES (?, ?, ?)',
  );
  for (const generation of generations) {
    const available = types
      .filter((type) => resourceId(type.generation) <= generation.id)
      .sort((left, right) => typeDisplayOrder(left.name) - typeDisplayOrder(right.name));
    available.forEach((type, index) => {
      insertGenerationType.run(generation.id, type.id, index + 1);
    });
  }

  const insertSpecies = database.prepare(
    'INSERT INTO pokemon_species (id, national_dex_number, identifier, name, introduced_generation_id) VALUES (?, ?, ?, ?, ?)',
  );
  for (const entry of species) {
    insertSpecies.run(
      entry.id,
      entry.id,
      entry.name,
      englishName(entry.names, entry.name),
      resourceId(entry.generation),
    );
  }

  const categories = [
    [1, 'standard', 'Standard', 1],
    [2, 'cosmetic', 'Cosmetic', 2],
    [3, 'transformation', 'Transformation', 3],
    [4, 'battle_only', 'Battle-only', 4],
  ] as const;
  const insertCategory = database.prepare(
    'INSERT INTO form_categories (id, identifier, name, display_order) VALUES (?, ?, ?, ?)',
  );
  for (const category of categories) insertCategory.run(...category);

  const insertAbility = database.prepare(
    'INSERT INTO abilities (id, identifier, name, introduced_generation_id) VALUES (?, ?, ?, ?)',
  );
  for (const ability of abilities) {
    insertAbility.run(
      ability.id,
      ability.name,
      englishName(ability.names, ability.name),
      resourceId(ability.generation),
    );
  }

  const stats = [
    [1, 'hp', 'HP', 'HP', 1],
    [2, 'attack', 'Attack', 'Atk', 2],
    [3, 'defense', 'Defense', 'Def', 3],
    [9, 'special', 'Special', 'Spc', 4],
    [4, 'special-attack', 'Special Attack', 'Sp. Atk', 5],
    [5, 'special-defense', 'Special Defense', 'Sp. Def', 6],
    [6, 'speed', 'Speed', 'Spe', 7],
  ] as const;
  const insertStat = database.prepare(
    'INSERT INTO stat_definitions (id, identifier, name, abbreviation, display_order) VALUES (?, ?, ?, ?, ?)',
  );
  for (const stat of stats) insertStat.run(...stat);

  const insertForm = database.prepare(
    'INSERT INTO pokemon_forms (id, pokemon_id, species_id, identifier, name, form_name, category_id, introduced_generation_id, is_default, is_battle_only, is_mega, form_order, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertFormGeneration = database.prepare(
    'INSERT INTO form_generations (form_id, generation_id) VALUES (?, ?)',
  );
  const insertFormType = database.prepare(
    'INSERT INTO form_types (form_id, generation_id, type_id, slot) VALUES (?, ?, ?, ?)',
  );
  const insertFormStat = database.prepare(
    'INSERT INTO form_stats (form_id, generation_id, stat_id, base_value) VALUES (?, ?, ?, ?)',
  );
  const insertFormAbility = database.prepare(
    'INSERT INTO form_abilities (form_id, generation_id, ability_id, slot, is_hidden) VALUES (?, ?, ?, ?, ?)',
  );
  const insertImage = database.prepare(
    'INSERT INTO image_assets (form_id, kind, source_url, relative_path, source_reference_id, rights_notice) VALUES (?, ?, ?, ?, ?, ?)',
  );

  let importedForms = 0;
  for (const form of forms) {
    const pokemonId = resourceId(form.pokemon);
    const pokemonEntry = pokemonById.get(pokemonId);
    if (!pokemonEntry) continue;

    const speciesId = resourceId(pokemonEntry.species);
    const speciesEntry = speciesById.get(speciesId);
    if (!speciesEntry) continue;

    const speciesGeneration = resourceId(speciesEntry.generation);
    const formGeneration =
      versionGeneration.get(form.version_group.name) ?? speciesGeneration;
    const introducedGeneration = Math.max(speciesGeneration, formGeneration);
    if (introducedGeneration > 9) continue;

    const defaultPokemonId = defaultPokemonBySpecies.get(speciesId);
    const defaultPokemon = defaultPokemonId
      ? pokemonById.get(defaultPokemonId)
      : undefined;
    const isSameAsDefault =
      defaultPokemon !== undefined &&
      pokemonId !== defaultPokemonId &&
      battleSignature(pokemonEntry) === battleSignature(defaultPokemon);
    const isSecondaryCosmeticForm =
      pokemonEntry.forms.length > 1 && !form.is_default;

    let categoryId = 1;
    if (form.is_mega || form.name.includes('-gmax')) categoryId = 3;
    else if (form.is_battle_only) categoryId = 4;
    else if (isSameAsDefault || isSecondaryCosmeticForm) categoryId = 2;

    const speciesName = englishName(speciesEntry.names, speciesEntry.name);
    insertForm.run(
      form.id,
      pokemonId,
      speciesId,
      form.name,
      formDisplayName(form, speciesName),
      form.form_name || null,
      categoryId,
      introducedGeneration,
      form.is_default ? 1 : 0,
      form.is_battle_only ? 1 : 0,
      form.is_mega ? 1 : 0,
      form.form_order,
      pokemonEntry.order,
    );

    for (let generationId = introducedGeneration; generationId <= 9; generationId += 1) {
      insertFormGeneration.run(form.id, generationId);

      for (const type of historicalTypes(pokemonEntry, generationId)) {
        const typeId = resourceId(type.type);
        if (STANDARD_TYPE_IDS.has(typeId)) {
          insertFormType.run(form.id, generationId, typeId, type.slot);
        }
      }

      for (const [statId, value] of historicalStats(pokemonEntry, generationId)) {
        if ([1, 2, 3, 4, 5, 6, 9].includes(statId)) {
          insertFormStat.run(form.id, generationId, statId, value);
        }
      }

      for (const ability of historicalAbilities(pokemonEntry, generationId)) {
        if (!ability.ability) continue;
        const abilityId = resourceId(ability.ability);
        if (!abilities.some((entry) => entry.id === abilityId)) continue;
        insertFormAbility.run(
          form.id,
          generationId,
          abilityId,
          ability.slot,
          ability.is_hidden ? 1 : 0,
        );
      }
    }

    const homeUrl = pokemonEntry.sprites.other?.home?.front_default ?? null;
    const artworkUrl =
      pokemonEntry.sprites.other?.['official-artwork']?.front_default ?? null;
    const sourceUrl = homeUrl ?? artworkUrl ?? pokemonEntry.sprites.front_default;
    const kind = homeUrl ? 'home' : artworkUrl ? 'official_artwork' : 'default_sprite';
    insertImage.run(
      form.id,
      kind,
      sourceUrl ? pinnedSpriteUrl(sourceUrl, spriteSource.commit) : null,
      sourceUrl ? `pokemon/${pokemonId}.png` : null,
      spriteSourceId,
      spriteSource.rights_notice,
    );

    importedForms += 1;
  }

  const insertRuleset = database.prepare(
    'INSERT INTO type_chart_rulesets (identifier, name, matrix_hash) VALUES (?, ?, ?)',
  );
  const insertRulesetType = database.prepare(
    'INSERT INTO ruleset_types (ruleset_id, type_id, display_order) VALUES (?, ?, ?)',
  );
  const insertEffectiveness = database.prepare(
    'INSERT INTO type_effectiveness (ruleset_id, attacking_type_id, defending_type_id, numerator, denominator) VALUES (?, ?, ?, ?, ?)',
  );
  const mapGenerationRuleset = database.prepare(
    'INSERT INTO generation_type_chart_rulesets (generation_id, ruleset_id) VALUES (?, ?)',
  );
  const rulesetByHash = new Map<string, number>();

  for (const generation of generations) {
    const available = types
      .filter((type) => resourceId(type.generation) <= generation.id)
      .sort((left, right) => typeDisplayOrder(left.name) - typeDisplayOrder(right.name));
    const matrix: Array<[number, number, number, number]> = [];

    for (const attacking of available) {
      const relations = relationForGeneration(attacking, generation.id);
      const noDamage = new Set(relations.no_damage_to.map(resourceId));
      const halfDamage = new Set(relations.half_damage_to.map(resourceId));
      const doubleDamage = new Set(relations.double_damage_to.map(resourceId));

      for (const defending of available) {
        let numerator = 1;
        let denominator = 1;
        if (noDamage.has(defending.id)) numerator = 0;
        else if (halfDamage.has(defending.id)) denominator = 2;
        else if (doubleDamage.has(defending.id)) numerator = 2;
        matrix.push([attacking.id, defending.id, numerator, denominator]);
      }
    }

    const matrixHash = sha256(JSON.stringify(matrix));
    let rulesetId = rulesetByHash.get(matrixHash);
    if (!rulesetId) {
      const result = insertRuleset.run(
        `generation_${generation.id}_chart`,
        `Generation ${generation.id} Type Chart`,
        matrixHash,
      );
      rulesetId = Number(result.lastInsertRowid);
      rulesetByHash.set(matrixHash, rulesetId);
      available.forEach((type, index) =>
        insertRulesetType.run(rulesetId, type.id, index + 1),
      );
      for (const [attacking, defending, numerator, denominator] of matrix) {
        insertEffectiveness.run(
          rulesetId,
          attacking,
          defending,
          numerator,
          denominator,
        );
      }
    }

    mapGenerationRuleset.run(generation.id, rulesetId);
  }

  const buildResult = database.prepare(
    'INSERT INTO dataset_builds (schema_version, built_at, importer_version, source_commit, source_retrieved_at, override_revision, validation_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    SCHEMA_VERSION,
    new Date().toISOString(),
    IMPORTER_VERSION,
    apiSource.commit,
    new Date().toISOString(),
    overrideRevision(),
    'pending',
  );

  return {
    apiSourceId: Number(apiSourceResult.lastInsertRowid),
    buildId: Number(buildResult.lastInsertRowid),
    importedForms,
  };
});

try {
  const result = build();
  database.pragma('foreign_key_check');
  database.close();
  console.log(`Created ${output}`);
  console.log(`Imported ${species.length} species and ${result.importedForms} forms.`);
  console.log(`Dataset build id: ${result.buildId}`);
} catch (error) {
  database.close();
  fs.rmSync(output, { force: true });
  throw error;
}
