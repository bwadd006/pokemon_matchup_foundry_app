import fs from 'node:fs';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
} from 'electron';
import started from 'electron-squirrel-startup';

import { closeReferenceDatabase, getReferenceDatabase } from './database/connection';
import {
  datasetInformation,
  listGenerations,
  listPokedexRows,
  listTypes,
} from './database/pokedex_queries';
import { ipcChannels } from '../shared/ipc/contracts';
import { getTypeChart } from './database/type_chart_queries';
import { listTeamBuilderOptions } from './database/team_builder_queries';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

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
    ipcChannels.listTeamBuilderOptions,
    (_event, generationId: number) =>
      listTeamBuilderOptions(getReferenceDatabase(), generationId),
  );
  ipcMain.handle(ipcChannels.datasetInformation, () =>
    datasetInformation(getReferenceDatabase()),
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
  if (process.platform !== 'darwin') app.quit();
});
