import { describe, expect, it } from 'vitest';

import type { TeamMemberSelection } from '../../src/shared/models/team';
import {
  ATTACKING_TYPE_SLOT_COUNT,
  fixedAttackingSlots,
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
