export const STANDARD_TYPE_DISPLAY_ORDER = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

const TYPE_DISPLAY_ORDER_BY_IDENTIFIER = new Map(
  STANDARD_TYPE_DISPLAY_ORDER.map((identifier, index) => [identifier, index]),
);

export function typeDisplayOrder(identifier: string): number {
  const displayOrder = TYPE_DISPLAY_ORDER_BY_IDENTIFIER.get(
    identifier as (typeof STANDARD_TYPE_DISPLAY_ORDER)[number],
  );
  if (displayOrder === undefined) {
    throw new Error(`No standard display order is defined for type ${identifier}.`);
  }
  return displayOrder;
}
