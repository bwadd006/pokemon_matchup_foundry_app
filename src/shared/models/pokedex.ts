export type FormCategory =
  | 'standard'
  | 'cosmetic'
  | 'transformation'
  | 'battle_only';

export interface Generation {
  id: number;
  identifier: string;
  name: string;
}

export interface PokemonType {
  id: number;
  identifier: string;
  name: string;
}

export interface PokedexRow {
  nationalDexNumber: number;
  formId: number;
  pokemonId: number;
  identifier: string;
  name: string;
  category: FormCategory;
  typeOne: string | null;
  typeOneIdentifier: string | null;
  typeTwo: string | null;
  typeTwoIdentifier: string | null;
  hp: number | null;
  attack: number | null;
  defense: number | null;
  special: number | null;
  specialAttack: number | null;
  specialDefense: number | null;
  speed: number | null;
  bst: number;
  abilityOne: string | null;
  abilityTwo: string | null;
  hiddenAbility: string | null;
  imagePath: string | null;
  imageKind: string | null;
}

export interface DatasetInformation {
  schemaVersion: number;
  builtAt: string;
  sourceCommit: string;
  validationStatus: 'pending' | 'passed' | 'failed';
}
