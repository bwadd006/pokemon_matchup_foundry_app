import fs from 'node:fs';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
} from 'electron';
import started from 'electron-squirrel-startup';

import {
  closeReferenceDatabase,
  closeUserDataDatabase,
  getReferenceDatabase,
  getUserDataDatabase,
} from './database/connection';
import {
  datasetInformation,
  listGenerations,
  listPokedexRows,
  listTypes,
} from './database/pokedex_queries';
import { ipcChannels } from '../shared/ipc/contracts';
import { getTypeChart } from './database/type_chart_queries';
import { listTeamPokemonOptions } from './database/team_pokemon_queries';
import {
  createSavedTeam,
  deleteSavedTeam,
  listSavedTeams,
  renameSavedTeam,
  updateSavedTeam,
} from './database/saved_team_queries';
import type {
  ApplicationMessageRequest,
} from '../shared/ipc/contracts';
import type {
  SavedTeamCreateInput,
  SavedTeamUpdateInput,
} from '../shared/models/team';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const approvedToClose = new Set<number>();

if (started) app.quit();

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pmf-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

function assetRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'images')
    : path.join(process.cwd(), 'resources', 'images');
}

function registerAssetProtocol(): void {
  protocol.registerFileProtocol('pmf-asset', (request, callback) => {
    try {
      const requestUrl = new URL(request.url);
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const root = path.resolve(assetRoot());
      const requested = path.resolve(root, relativePath);

      if (requested !== root && !requested.startsWith(root + path.sep)) {
        callback({ error: -10 });
        return;
      }

      fs.access(requested, fs.constants.R_OK, (error) => {
        callback(error ? { error: -6 } : { path: requested });
      });
    } catch {
      callback({ error: -324 });
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.listGenerations, () =>
    listGenerations(getReferenceDatabase()),
  );
  ipcMain.handle(ipcChannels.listTypes, (_event, generationId: number) =>
    listTypes(getReferenceDatabase(), generationId),
  );
  ipcMain.handle(ipcChannels.listPokedexRows, (_event, generationId: number) =>
    listPokedexRows(getReferenceDatabase(), generationId),
  );
  ipcMain.handle(ipcChannels.getTypeChart, (_event, generationId: number) =>
    getTypeChart(getReferenceDatabase(), generationId),
  );
  ipcMain.handle(
    ipcChannels.listTeamPokemonOptions,
    (_event, generationId: number) =>
      listTeamPokemonOptions(getReferenceDatabase(), generationId),
  );
  ipcMain.handle(ipcChannels.datasetInformation, () =>
    datasetInformation(getReferenceDatabase()),
  );
  ipcMain.handle(ipcChannels.listSavedTeams, () =>
    listSavedTeams(getUserDataDatabase()),
  );
  ipcMain.handle(
    ipcChannels.createSavedTeam,
    (_event, input: SavedTeamCreateInput) =>
      createSavedTeam(getUserDataDatabase(), input),
  );
  ipcMain.handle(
    ipcChannels.updateSavedTeam,
    (_event, id: string, input: SavedTeamUpdateInput) =>
      updateSavedTeam(getUserDataDatabase(), id, input),
  );
  ipcMain.handle(
    ipcChannels.renameSavedTeam,
    (_event, id: string, name: string) =>
      renameSavedTeam(getUserDataDatabase(), id, name),
  );
  ipcMain.handle(ipcChannels.deleteSavedTeam, (_event, id: string) =>
    deleteSavedTeam(getUserDataDatabase(), id),
  );
  ipcMain.on(ipcChannels.confirmClose, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    approvedToClose.add(window.id);
    window.close();
  });
  ipcMain.handle(
    ipcChannels.showMessage,
    async (event, request: ApplicationMessageRequest) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const options = {
        type: request.type,
        title: request.title,
        message: request.message,
        detail: request.detail,
        buttons: request.buttons,
        defaultId: request.defaultId ?? 0,
        cancelId: request.cancelId,
        noLink: true,
      } as const;
      const result = window
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options);
      return result.response;
    },
  );
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#101828',
    title: 'Pokémon Matchup Foundry',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  window.on('close', (event) => {
    if (approvedToClose.has(window.id)) return;
    event.preventDefault();
    window.webContents.send(ipcChannels.requestClose);
  });
  window.on('closed', () => approvedToClose.delete(window.id));
}

app.whenReady().then(() => {
  registerAssetProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeReferenceDatabase();
  closeUserDataDatabase();
  if (process.platform !== 'darwin') app.quit();
});
