import type {
  DatasetInformation,
  Generation,
  PokedexRow,
  PokemonType,
} from '../models/pokedex';
import type { TypeChart } from '../models/type_effectiveness';
import type {
  SavedTeam,
  SavedTeamCreateInput,
  SavedTeamUpdateInput,
  TeamPokemonOption,
} from '../models/team';

export const ipcChannels = {
  listGenerations: 'reference-data:list-generations',
  listTypes: 'reference-data:list-types',
  listPokedexRows: 'reference-data:list-pokedex-rows',
  getTypeChart: 'reference-data:get-type-chart',
  listTeamPokemonOptions: 'reference-data:list-team-pokemon-options',
  datasetInformation: 'reference-data:dataset-information',
  listSavedTeams: 'user-data:list-saved-teams',
  createSavedTeam: 'user-data:create-saved-team',
  updateSavedTeam: 'user-data:update-saved-team',
  renameSavedTeam: 'user-data:rename-saved-team',
  deleteSavedTeam: 'user-data:delete-saved-team',
  requestClose: 'application:request-close',
  confirmClose: 'application:confirm-close',
  showMessage: 'application:show-message',
} as const;

export interface ApplicationMessageRequest {
  type: 'info' | 'warning' | 'error' | 'question';
  title: string;
  message: string;
  detail?: string;
  buttons: string[];
  defaultId?: number;
  cancelId?: number;
}

export interface PokemonMatchupFoundryApi {
  listGenerations(): Promise<Generation[]>;
  listTypes(generationId: number): Promise<PokemonType[]>;
  listPokedexRows(generationId: number): Promise<PokedexRow[]>;
  getTypeChart(generationId: number): Promise<TypeChart>;
  listTeamPokemonOptions(generationId: number): Promise<TeamPokemonOption[]>;
  datasetInformation(): Promise<DatasetInformation>;
  listSavedTeams(): Promise<SavedTeam[]>;
  createSavedTeam(input: SavedTeamCreateInput): Promise<SavedTeam>;
  updateSavedTeam(id: string, input: SavedTeamUpdateInput): Promise<SavedTeam>;
  renameSavedTeam(id: string, name: string): Promise<SavedTeam>;
  deleteSavedTeam(id: string): Promise<void>;
  onCloseRequested(callback: () => void): () => void;
  confirmClose(): void;
  showMessage(request: ApplicationMessageRequest): Promise<number>;
}
