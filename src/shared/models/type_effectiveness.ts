import type { ExactMultiplier } from '../mechanics/type_effectiveness';
import type { PokemonType } from './pokedex';

export interface TypeChartMatchup extends ExactMultiplier {
  attackingTypeId: number;
  defendingTypeId: number;
}

export interface TypeChart {
  generationId: number;
  rulesetIdentifier: string;
  types: PokemonType[];
  matchups: TypeChartMatchup[];
}
