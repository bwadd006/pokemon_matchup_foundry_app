import { describe, expect, it } from 'vitest';

import type { TeamMemberSelection } from '../../src/shared/models/team';
import {
  ATTACKING_TYPE_SLOT_COUNT,
  fixedAttackingSlots,
  reorderTeamSlots,
  TEAM_SLOT_COUNT,
} from '../../src/shared/team_slots';

function member(attackingTypeIdentifiers: Array<string | null>): TeamMemberSelection {
  return {
    formId: 1,
    pokemonId: 1,
    nationalDexNumber: 1,
    identifier: 'bulbasaur',
    name: 'Bulbasaur',
    imagePath: null,
    types: [{ id: 12, identifier: 'grass', name: 'Grass' }],
    ability: null,
    attackingTypeIdentifiers,
  };
}

describe('fixed team attacking slots', () => {
  it('always provides six groups of four rows for an empty team', () => {
    const groups = fixedAttackingSlots([]);

    expect(groups).toHaveLength(TEAM_SLOT_COUNT);
    expect(groups.flatMap((group) => group.attackingTypeIdentifiers)).toHaveLength(
      TEAM_SLOT_COUNT * ATTACKING_TYPE_SLOT_COUNT,
    );
    expect(groups.every((group) => group.selection === null)).toBe(true);
    expect(
      groups.every((group) =>
        group.attackingTypeIdentifiers.every((identifier) => identifier === null),
      ),
    ).toBe(true);
  });

  it('preserves positions and pads each selected Pokémon to four entries', () => {
    const groups = fixedAttackingSlots([
      null,
      null,
      member(['grass', null, 'poison']),
    ]);

    expect(groups[2]?.selection?.name).toBe('Bulbasaur');
    expect(groups[2]?.attackingTypeIdentifiers).toEqual([
      'grass',
      null,
      'poison',
      null,
    ]);
    expect(groups[0]?.attackingTypeIdentifiers).toEqual([null, null, null, null]);
  });
});

describe('team slot reordering', () => {
  it('inserts a member at an earlier slot and shifts intervening empty slots', () => {
    const bulbasaur = member(['grass', 'poison', null, null]);
    const charmander = { ...member(['fire', null, null, null]), name: 'Charmander' };
    const squirtle = { ...member(['water', null, null, null]), name: 'Squirtle' };

    const reordered = reorderTeamSlots(
      [bulbasaur, null, charmander, squirtle, null, null],
      3,
      0,
    );

    expect(reordered).toEqual([
      squirtle,
      bulbasaur,
      null,
      charmander,
      null,
      null,
    ]);
    expect(reordered[0]).toBe(squirtle);
  });

  it('inserts a member at a later slot and shifts intervening slots left', () => {
    const bulbasaur = member(['grass', null, null, null]);
    const charmander = { ...member(['fire', null, null, null]), name: 'Charmander' };
    const squirtle = { ...member(['water', null, null, null]), name: 'Squirtle' };

    expect(reorderTeamSlots([bulbasaur, charmander, null, squirtle], 0, 3)).toEqual([
      charmander,
      null,
      squirtle,
      bulbasaur,
      null,
      null,
    ]);
  });

  it('preserves the fixed six-slot shape for invalid or empty-source moves', () => {
    const bulbasaur = member(['grass']);

    expect(reorderTeamSlots([bulbasaur], 1, 4)).toEqual([
      bulbasaur,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(reorderTeamSlots([bulbasaur], -1, 4)).toHaveLength(TEAM_SLOT_COUNT);
  });
});
