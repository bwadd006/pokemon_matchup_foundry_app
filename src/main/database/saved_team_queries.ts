import { randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';

import type {
  SavedTeam,
  SavedTeamCreateInput,
  SavedTeamUpdateInput,
  TeamAbility,
  TeamMemberSelection,
  TeamSlot,
} from '../../shared/models/team';
import type { PokemonType } from '../../shared/models/pokedex';

interface SavedTeamRow {
  id: string;
  name: string;
  generation_id: number;
  created_at: string;
  updated_at: string;
}

interface SavedSlotRow {
  slot_index: number;
  form_id: number | null;
  pokemon_id: number | null;
  national_dex_number: number | null;
  identifier: string | null;
  name: string | null;
  image_path: string | null;
  types_json: string | null;
  ability_json: string | null;
}

interface AttackTypeRow {
  slot_index: number;
  entry_index: number;
  identifier: string | null;
}

const nameLimit = 80;

export function normalizeSavedTeamName(name: string): string {
  return name.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function validateSavedTeamName(name: string): string {
  const displayName = name.trim();
  if ([...displayName].length === 0) {
    throw new Error('Enter a team name.');
  }
  if ([...displayName].length > nameLimit) {
    throw new Error(`Team names cannot exceed ${nameLimit} characters.`);
  }
  return displayName;
}

function validateTeamInput(generationId: number, slots: TeamSlot[]): void {
  if (!Number.isInteger(generationId) || generationId < 1) {
    throw new Error('Select a valid generation.');
  }
  if (slots.length !== 6) {
    throw new Error('A saved team must contain exactly six slot positions.');
  }
  if (!slots.some((slot) => slot !== null)) {
    throw new Error('Add at least one Pokémon before saving a team.');
  }
}

export function initializeSavedTeamDatabase(database: Database.Database): void {
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_data_schema_versions (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      generation_id INTEGER NOT NULL CHECK (generation_id >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_team_slots (
      team_id TEXT NOT NULL REFERENCES saved_teams(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 5),
      form_id INTEGER,
      pokemon_id INTEGER,
      national_dex_number INTEGER,
      identifier TEXT,
      name TEXT,
      image_path TEXT,
      types_json TEXT,
      ability_json TEXT,
      PRIMARY KEY (team_id, slot_index),
      CHECK (
        (form_id IS NULL AND pokemon_id IS NULL AND national_dex_number IS NULL
          AND identifier IS NULL AND name IS NULL AND types_json IS NULL
          AND ability_json IS NULL)
        OR
        (form_id IS NOT NULL AND pokemon_id IS NOT NULL
          AND national_dex_number IS NOT NULL AND identifier IS NOT NULL
          AND name IS NOT NULL AND types_json IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS saved_team_attacking_types (
      team_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 5),
      entry_index INTEGER NOT NULL CHECK (entry_index BETWEEN 0 AND 3),
      identifier TEXT,
      PRIMARY KEY (team_id, slot_index, entry_index),
      FOREIGN KEY (team_id, slot_index)
        REFERENCES saved_team_slots(team_id, slot_index) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS saved_teams_generation_index
      ON saved_teams(generation_id);
    CREATE INDEX IF NOT EXISTS saved_teams_updated_index
      ON saved_teams(updated_at);
    CREATE INDEX IF NOT EXISTS saved_team_slots_identifier_index
      ON saved_team_slots(identifier);
  `);

  database.prepare(`
    INSERT OR IGNORE INTO user_data_schema_versions (version, applied_at)
    VALUES (1, ?)
  `).run(new Date().toISOString());
}

function normalizedAttackTypes(slot: TeamSlot): Array<string | null> {
  return Array.from(
    { length: 4 },
    (_entry, index) => slot?.attackingTypeIdentifiers[index] ?? null,
  );
}

function replaceTeamContents(
  database: Database.Database,
  teamId: string,
  slots: TeamSlot[],
): void {
  database.prepare('DELETE FROM saved_team_slots WHERE team_id = ?').run(teamId);

  const insertSlot = database.prepare(`
    INSERT INTO saved_team_slots (
      team_id, slot_index, form_id, pokemon_id, national_dex_number,
      identifier, name, image_path, types_json, ability_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAttackType = database.prepare(`
    INSERT INTO saved_team_attacking_types (
      team_id, slot_index, entry_index, identifier
    ) VALUES (?, ?, ?, ?)
  `);

  slots.forEach((slot, slotIndex) => {
    insertSlot.run(
      teamId,
      slotIndex,
      slot?.formId ?? null,
      slot?.pokemonId ?? null,
      slot?.nationalDexNumber ?? null,
      slot?.identifier ?? null,
      slot?.name ?? null,
      slot?.imagePath ?? null,
      slot ? JSON.stringify(slot.types) : null,
      slot?.ability ? JSON.stringify(slot.ability) : null,
    );
    normalizedAttackTypes(slot)
      .forEach((identifier, entryIndex) => {
        insertAttackType.run(teamId, slotIndex, entryIndex, identifier);
      });
  });
}

function readSavedTeam(
  database: Database.Database,
  teamRow: SavedTeamRow,
): SavedTeam {
  const slotRows = database.prepare(`
    SELECT slot_index, form_id, pokemon_id, national_dex_number, identifier,
           name, image_path, types_json, ability_json
    FROM saved_team_slots
    WHERE team_id = ?
    ORDER BY slot_index
  `).all(teamRow.id) as SavedSlotRow[];
  const attackRows = database.prepare(`
    SELECT slot_index, entry_index, identifier
    FROM saved_team_attacking_types
    WHERE team_id = ?
    ORDER BY slot_index, entry_index
  `).all(teamRow.id) as AttackTypeRow[];
  const attacksBySlot = new Map<number, Array<string | null>>();
  for (let slotIndex = 0; slotIndex < 6; slotIndex += 1) {
    attacksBySlot.set(slotIndex, [null, null, null, null]);
  }
  for (const row of attackRows) {
    attacksBySlot.get(row.slot_index)![row.entry_index] = row.identifier;
  }

  const rowsByIndex = new Map(slotRows.map((row) => [row.slot_index, row]));
  const slots = Array.from({ length: 6 }, (_entry, slotIndex): TeamSlot => {
    const row = rowsByIndex.get(slotIndex);
    if (!row || row.form_id === null) return null;
    return {
      formId: row.form_id,
      pokemonId: row.pokemon_id!,
      nationalDexNumber: row.national_dex_number!,
      identifier: row.identifier!,
      name: row.name!,
      imagePath: row.image_path,
      types: JSON.parse(row.types_json!) as PokemonType[],
      ability: row.ability_json
        ? JSON.parse(row.ability_json) as TeamAbility
        : null,
      attackingTypeIdentifiers: attacksBySlot.get(slotIndex)!,
    };
  });

  return {
    id: teamRow.id,
    name: teamRow.name,
    generationId: teamRow.generation_id,
    createdAt: teamRow.created_at,
    updatedAt: teamRow.updated_at,
    slots,
  };
}

export function listSavedTeams(database: Database.Database): SavedTeam[] {
  const rows = database.prepare(`
    SELECT id, name, generation_id, created_at, updated_at
    FROM saved_teams
    ORDER BY normalized_name, id
  `).all() as SavedTeamRow[];
  return rows.map((row) => readSavedTeam(database, row));
}

export function getSavedTeam(
  database: Database.Database,
  id: string,
): SavedTeam {
  const row = database.prepare(`
    SELECT id, name, generation_id, created_at, updated_at
    FROM saved_teams
    WHERE id = ?
  `).get(id) as SavedTeamRow | undefined;
  if (!row) throw new Error('The saved team no longer exists.');
  return readSavedTeam(database, row);
}

function translateConstraintError(error: unknown): never {
  if (error instanceof Error && error.message.includes('saved_teams.normalized_name')) {
    throw new Error('A saved team already uses that name.');
  }
  throw error;
}

function nextModifiedTimestamp(database: Database.Database, id: string): string {
  const row = database.prepare(
    'SELECT updated_at FROM saved_teams WHERE id = ?',
  ).get(id) as { updated_at: string } | undefined;
  if (!row) throw new Error('The saved team no longer exists.');
  const previous = new Date(row.updated_at).getTime();
  return new Date(Math.max(Date.now(), previous + 1)).toISOString();
}

export function createSavedTeam(
  database: Database.Database,
  input: SavedTeamCreateInput,
): SavedTeam {
  const name = validateSavedTeamName(input.name);
  validateTeamInput(input.generationId, input.slots);
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  try {
    database.transaction(() => {
      database.prepare(`
        INSERT INTO saved_teams (
          id, name, normalized_name, generation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        normalizeSavedTeamName(name),
        input.generationId,
        timestamp,
        timestamp,
      );
      replaceTeamContents(database, id, input.slots);
    })();
  } catch (error) {
    translateConstraintError(error);
  }

  return getSavedTeam(database, id);
}

export function updateSavedTeam(
  database: Database.Database,
  id: string,
  input: SavedTeamUpdateInput,
): SavedTeam {
  validateTeamInput(input.generationId, input.slots);
  const timestamp = nextModifiedTimestamp(database, id);
  database.transaction(() => {
    const result = database.prepare(`
      UPDATE saved_teams
      SET generation_id = ?, updated_at = ?
      WHERE id = ?
    `).run(input.generationId, timestamp, id);
    if (result.changes === 0) throw new Error('The saved team no longer exists.');
    replaceTeamContents(database, id, input.slots);
  })();
  return getSavedTeam(database, id);
}

export function renameSavedTeam(
  database: Database.Database,
  id: string,
  requestedName: string,
): SavedTeam {
  const name = validateSavedTeamName(requestedName);
  try {
    const timestamp = nextModifiedTimestamp(database, id);
    const result = database.prepare(`
      UPDATE saved_teams
      SET name = ?, normalized_name = ?, updated_at = ?
      WHERE id = ?
    `).run(name, normalizeSavedTeamName(name), timestamp, id);
    if (result.changes === 0) throw new Error('The saved team no longer exists.');
  } catch (error) {
    translateConstraintError(error);
  }
  return getSavedTeam(database, id);
}

export function deleteSavedTeam(database: Database.Database, id: string): void {
  const result = database.prepare('DELETE FROM saved_teams WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('The saved team no longer exists.');
}
