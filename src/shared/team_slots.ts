import type { TeamMemberSelection, TeamSlot } from './models/team';

export const TEAM_SLOT_COUNT = 6;
export const ATTACKING_TYPE_SLOT_COUNT = 4;

export interface FixedAttackingSlot {
  slotIndex: number;
  selection: TeamSlot;
  attackingTypeIdentifiers: Array<string | null>;
}

export function normalizedAttackTypes(
  selection: TeamMemberSelection,
): Array<string | null> {
  return Array.from(
    { length: ATTACKING_TYPE_SLOT_COUNT },
    (_entry, index) => selection.attackingTypeIdentifiers[index] ?? null,
  );
}

export function fixedAttackingSlots(slots: TeamSlot[]): FixedAttackingSlot[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, (_entry, slotIndex) => {
    const selection = slots[slotIndex] ?? null;
    return {
      slotIndex,
      selection,
      attackingTypeIdentifiers: selection
        ? normalizedAttackTypes(selection)
        : Array.from({ length: ATTACKING_TYPE_SLOT_COUNT }, () => null),
    };
  });
}

export function reorderTeamSlots(
  slots: TeamSlot[],
  fromSlotIndex: number,
  toSlotIndex: number,
): TeamSlot[] {
  const fixedSlots = Array.from(
    { length: TEAM_SLOT_COUNT },
    (_entry, slotIndex) => slots[slotIndex] ?? null,
  );

  const indicesAreValid = [fromSlotIndex, toSlotIndex].every(
    (slotIndex) =>
      Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < TEAM_SLOT_COUNT,
  );
  if (!indicesAreValid || fromSlotIndex === toSlotIndex || !fixedSlots[fromSlotIndex]) {
    return fixedSlots;
  }

  const [selection] = fixedSlots.splice(fromSlotIndex, 1);
  fixedSlots.splice(toSlotIndex, 0, selection ?? null);
  return fixedSlots;
}
