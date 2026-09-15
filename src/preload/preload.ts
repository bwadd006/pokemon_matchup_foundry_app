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
  listTeamPokemonOptions: (generationId) =>
    ipcRenderer.invoke(ipcChannels.listTeamPokemonOptions, generationId),
  datasetInformation: () =>
    ipcRenderer.invoke(ipcChannels.datasetInformation),
  listSavedTeams: () =>
    ipcRenderer.invoke(ipcChannels.listSavedTeams),
  createSavedTeam: (input) =>
    ipcRenderer.invoke(ipcChannels.createSavedTeam, input),
  updateSavedTeam: (id, input) =>
    ipcRenderer.invoke(ipcChannels.updateSavedTeam, id, input),
  renameSavedTeam: (id, name) =>
    ipcRenderer.invoke(ipcChannels.renameSavedTeam, id, name),
  deleteSavedTeam: (id) =>
    ipcRenderer.invoke(ipcChannels.deleteSavedTeam, id),
  onCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(ipcChannels.requestClose, listener);
    return () => ipcRenderer.removeListener(ipcChannels.requestClose, listener);
  },
  confirmClose: () => ipcRenderer.send(ipcChannels.confirmClose),
  showMessage: (request) => ipcRenderer.invoke(ipcChannels.showMessage, request),
};

contextBridge.exposeInMainWorld('pokemonMatchupFoundry', api);
