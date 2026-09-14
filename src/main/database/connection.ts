import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { app } from 'electron';

let referenceDatabase: Database.Database | undefined;

type DatabaseConstructor = typeof Database;

function loadDatabaseConstructor(): DatabaseConstructor {
  const report = process.report.getReport() as {
    header: { glibcVersionRuntime?: string };
  };
  const linuxPlatform = report.header.glibcVersionRuntime ? 'linux' : 'linuxmusl';
  const target = `${process.platform === 'linux' ? linuxPlatform : process.platform}-${process.arch}`;

  switch (target) {
    case 'darwin-arm64':
      return require('better-sqlite3/darwin-arm64') as DatabaseConstructor;
    case 'darwin-x64':
      return require('better-sqlite3/darwin-x64') as DatabaseConstructor;
    case 'linux-arm64':
      return require('better-sqlite3/linux-arm64') as DatabaseConstructor;
    case 'linux-x64':
      return require('better-sqlite3/linux-x64') as DatabaseConstructor;
    case 'linuxmusl-arm64':
      return require('better-sqlite3/linuxmusl-arm64') as DatabaseConstructor;
    case 'linuxmusl-x64':
      return require('better-sqlite3/linuxmusl-x64') as DatabaseConstructor;
    case 'win32-arm64':
      return require('better-sqlite3/win32-arm64') as DatabaseConstructor;
    case 'win32-x64':
      return require('better-sqlite3/win32-x64') as DatabaseConstructor;
    default:
      throw new Error(`Unsupported SQLite platform: ${target}`);
  }
}

function referenceDatabasePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'pokemon.sqlite')
    : path.join(process.cwd(), 'database', 'generated', 'pokemon.sqlite');
}

export function getReferenceDatabase(): Database.Database {
  if (referenceDatabase) return referenceDatabase;

  const databasePath = referenceDatabasePath();
  if (!fs.existsSync(databasePath)) {
    throw new Error(
      `Pokémon reference database is missing at ${databasePath}. Run npm run data:build.`,
    );
  }

  const DatabaseConstructor = loadDatabaseConstructor();
  referenceDatabase = new DatabaseConstructor(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  referenceDatabase.pragma('foreign_keys = ON');
  referenceDatabase.pragma('query_only = ON');
  return referenceDatabase;
}

export function closeReferenceDatabase(): void {
  referenceDatabase?.close();
  referenceDatabase = undefined;
}
