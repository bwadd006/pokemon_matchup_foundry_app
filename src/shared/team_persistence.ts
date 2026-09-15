import type {
  SavedTeam,
  TeamPokemonOption,
  TeamSlot,
} from './models/team';

export function teamHasPokemon(slots: TeamSlot[]): boolean {
  return slots.some((slot) => slot !== null);
}

function teamFingerprint(generationId: number, slots: TeamSlot[]): string {
  return JSON.stringify({
    generationId,
    slots: Array.from({ length: 6 }, (_entry, slotIndex) => {
      const slot = slots[slotIndex];
      if (!slot) return null;
      return {
        formId: slot.formId,
        abilityIdentifier: slot.ability?.identifier ?? null,
        attackingTypeIdentifiers: Array.from(
          { length: 4 },
          (_move, moveIndex) => slot.attackingTypeIdentifiers[moveIndex] ?? null,
        ),
      };
    }),
  });
}

export function activeTeamIsDirty(
  generationId: number,
  slots: TeamSlot[],
  savedTeam: SavedTeam | null,
): boolean {
  if (!savedTeam) return teamHasPokemon(slots);
  return teamFingerprint(generationId, slots)
    !== teamFingerprint(savedTeam.generationId, savedTeam.slots);
}

export function teamIsValidForGeneration(
  slots: TeamSlot[],
  options: TeamPokemonOption[],
  validAttackingTypes: Set<string>,
): boolean {
  const optionsByForm = new Map(options.map((option) => [option.formId, option]));
  return slots.every((slot) => {
    if (!slot) return true;
    const option = optionsByForm.get(slot.formId);
    if (!option) return false;
    if (
      slot.ability
      && !option.abilities.some(
        (ability) => ability.identifier === slot.ability?.identifier,
      )
    ) return false;
    return slot.attackingTypeIdentifiers.every(
      (identifier) => !identifier || validAttackingTypes.has(identifier),
    );
  });
}
