import { contextBridge, ipcRenderer } from 'electron';

import {
  ipcChannels,
  type PokemonMatchupFoundryApi,
} from '../shared/ipc/contracts';

const api: PokemonMatchupFoundryApi = {
  listGenerations: () => ipcRenderer.invoke(ipcChannels.listGenerations),
  listTypes: (generationId) =>
    ipcRenderer.invoke(ipcChannels.listTypes, generationId),
  listPokedexRows: (generationId) =>
    ipcRenderer.invoke(ipcChannels.listPokedexRows, generationId),
  getTypeChart: (generationId) =>
    ipcRenderer.invoke(ipcChannels.getTypeChart, generationId),
  listTeamBuilderOptions: (generationId) =>
    ipcRenderer.invoke(ipcChannels.listTeamBuilderOptions, generationId),
  datasetInformation: () =>
    ipcRenderer.invoke(ipcChannels.datasetInformation),
};

contextBridge.exposeInMainWorld('pokemonMatchupFoundry', api);
