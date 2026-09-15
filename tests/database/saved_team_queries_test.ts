import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSavedTeam,
  deleteSavedTeam,
  initializeSavedTeamDatabase,
  listSavedTeams,
  renameSavedTeam,
  updateSavedTeam,
} from '../../src/main/database/saved_team_queries';
import type { TeamMemberSelection, TeamSlot } from '../../src/shared/models/team';

function member(name = 'Gengar'): TeamMemberSelection {
  return {
    formId: 94,
    pokemonId: 94,
    nationalDexNumber: 94,
    identifier: name.toLocaleLowerCase(),
    name,
    imagePath: 'pokemon/94.png',
    types: [
      { id: 8, identifier: 'ghost', name: 'Ghost' },
      { id: 4, identifier: 'poison', name: 'Poison' },
    ],
    ability: {
      id: 26,
      identifier: 'levitate',
      name: 'Levitate',
      slot: 1,
      isHidden: false,
    },
    attackingTypeIdentifiers: ['ghost', null, 'poison', 'ghost'],
  };
}

function slots(): TeamSlot[] {
  return [null, null, member(), null, null, null];
}

describe('saved team storage', () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(':memory:');
    initializeSavedTeamDatabase(database);
  });

  afterEach(() => database.close());

  it('round-trips exact slot and attacking-type positions', () => {
    const saved = createSavedTeam(database, {
      name: "  Koga's Team  ",
      generationId: 6,
      slots: slots(),
    });

    expect(saved.name).toBe("Koga's Team");
    expect(saved.generationId).toBe(6);
    expect(saved.slots).toHaveLength(6);
    expect(saved.slots[0]).toBeNull();
    expect(saved.slots[2]?.name).toBe('Gengar');
    expect(saved.slots[2]?.ability?.identifier).toBe('levitate');
    expect(saved.slots[2]?.attackingTypeIdentifiers).toEqual([
      'ghost',
      null,
      'poison',
      'ghost',
    ]);
  });

  it('enforces case-insensitive normalized unique names', () => {
    createSavedTeam(database, {
      name: "Koga's Team",
      generationId: 6,
      slots: slots(),
    });

    expect(() => createSavedTeam(database, {
      name: "koga's team",
      generationId: 6,
      slots: slots(),
    })).toThrow('already uses that name');
    expect(listSavedTeams(database)).toHaveLength(1);
  });

  it('rejects empty teams and invalid names', () => {
    expect(() => createSavedTeam(database, {
      name: 'Empty',
      generationId: 9,
      slots: Array.from({ length: 6 }, () => null),
    })).toThrow('at least one Pokémon');
    expect(() => createSavedTeam(database, {
      name: '   ',
      generationId: 9,
      slots: slots(),
    })).toThrow('Enter a team name');
  });

  it('updates, renames, lists alphabetically, and deletes atomically', () => {
    const zTeam = createSavedTeam(database, {
      name: 'Z Team',
      generationId: 6,
      slots: slots(),
    });
    const aTeam = createSavedTeam(database, {
      name: 'A Team',
      generationId: 9,
      slots: slots(),
    });

    const nextSlots = slots();
    nextSlots[5] = member('Crobat');
    const updated = updateSavedTeam(database, zTeam.id, {
      generationId: 7,
      slots: nextSlots,
    });
    expect(updated.generationId).toBe(7);
    expect(updated.slots[5]?.name).toBe('Crobat');
    expect(updated.updatedAt > zTeam.updatedAt).toBe(true);

    const renamed = renameSavedTeam(database, zTeam.id, 'B Team');
    expect(renamed.name).toBe('B Team');
    expect(renamed.updatedAt > updated.updatedAt).toBe(true);
    expect(listSavedTeams(database).map((team) => team.name)).toEqual([
      'A Team',
      'B Team',
    ]);

    deleteSavedTeam(database, aTeam.id);
    expect(listSavedTeams(database).map((team) => team.name)).toEqual(['B Team']);
  });
});
