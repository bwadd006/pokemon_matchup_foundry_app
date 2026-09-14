import type { PokemonType } from './pokedex';

export type TeamFormCategory =
  | 'standard'
  | 'transformation'
  | 'battle_only';

export interface TeamAbility {
  id: number;
  identifier: string;
  name: string;
  slot: number;
  isHidden: boolean;
}

export interface TeamBuilderOption {
  formId: number;
  pokemonId: number;
  nationalDexNumber: number;
  identifier: string;
  name: string;
  category: TeamFormCategory;
  imagePath: string | null;
  types: PokemonType[];
  abilities: TeamAbility[];
}

export interface TeamMemberSelection {
  formId: number;
  pokemonId: number;
  nationalDexNumber: number;
  identifier: string;
  name: string;
  imagePath: string | null;
  types: PokemonType[];
  ability: TeamAbility | null;
  attackingTypeIdentifiers: Array<string | null>;
}

export type TeamSlot = TeamMemberSelection | null;
