import type {
  DatasetInformation,
  Generation,
  PokedexRow,
  PokemonType,
} from '../models/pokedex';
import type { TypeChart } from '../models/type_effectiveness';
import type { TeamBuilderOption } from '../models/team';

export const ipcChannels = {
  listGenerations: 'reference-data:list-generations',
  listTypes: 'reference-data:list-types',
  listPokedexRows: 'reference-data:list-pokedex-rows',
  getTypeChart: 'reference-data:get-type-chart',
  listTeamBuilderOptions: 'reference-data:list-team-builder-options',
  datasetInformation: 'reference-data:dataset-information',
} as const;

export interface PokemonMatchupFoundryApi {
  listGenerations(): Promise<Generation[]>;
  listTypes(generationId: number): Promise<PokemonType[]>;
  listPokedexRows(generationId: number): Promise<PokedexRow[]>;
  getTypeChart(generationId: number): Promise<TypeChart>;
  listTeamBuilderOptions(generationId: number): Promise<TeamBuilderOption[]>;
  datasetInformation(): Promise<DatasetInformation>;
}
