import { describe, expect, it } from 'vitest';

import type {
  SavedTeam,
  TeamPokemonOption,
  TeamMemberSelection,
  TeamSlot,
} from '../../src/shared/models/team';
import {
  activeTeamIsDirty,
  teamIsValidForGeneration,
} from '../../src/shared/team_persistence';

const member: TeamMemberSelection = {
  formId: 1,
  pokemonId: 1,
  nationalDexNumber: 1,
  identifier: 'bulbasaur',
  name: 'Bulbasaur',
  imagePath: null,
  types: [{ id: 12, identifier: 'grass', name: 'Grass' }],
  ability: null,
  attackingTypeIdentifiers: ['grass', null, null, null],
};

const slots: TeamSlot[] = [member, null, null, null, null, null];
const saved: SavedTeam = {
  id: 'saved-id',
  name: 'Starter',
  generationId: 1,
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  slots,
};
const option: TeamPokemonOption = {
  formId: 1,
  pokemonId: 1,
  nationalDexNumber: 1,
  identifier: 'bulbasaur',
  name: 'Bulbasaur',
  category: 'standard',
  imagePath: null,
  types: member.types,
  abilities: [],
};

describe('active saved-team state', () => {
  it('tracks saved fields without treating derived display data as dirty', () => {
    expect(activeTeamIsDirty(1, slots, saved)).toBe(false);
    expect(activeTeamIsDirty(2, slots, saved)).toBe(true);
    expect(activeTeamIsDirty(1, [
      { ...member, name: 'Updated display name' },
      null,
      null,
      null,
      null,
      null,
    ], saved)).toBe(false);
    expect(activeTeamIsDirty(1, [
      { ...member, attackingTypeIdentifiers: ['poison', null, null, null] },
      null,
      null,
      null,
      null,
      null,
    ], saved)).toBe(true);
  });

  it('validates forms, abilities, and attacking types', () => {
    expect(teamIsValidForGeneration(slots, [option], new Set(['grass']))).toBe(true);
    expect(teamIsValidForGeneration(slots, [], new Set(['grass']))).toBe(false);
    expect(teamIsValidForGeneration(slots, [option], new Set(['fire']))).toBe(false);
  });
});
