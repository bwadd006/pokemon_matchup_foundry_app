import type { PokemonMatchupFoundryApi } from '../shared/ipc/contracts';

declare global {
  interface Window {
    pokemonMatchupFoundry: PokemonMatchupFoundryApi;
  }
}

export {};
