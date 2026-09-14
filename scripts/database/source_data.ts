import fs from 'node:fs';
import path from 'node:path';

export interface NamedResource {
  name: string;
  url: string;
}

export interface SourceManifest {
  schema_version: number;
  sources: {
    pokeapi_api_data: {
      repository: string;
      commit: string;
      license: string;
      directories: string[];
    };
    pokeapi_sprites: {
      repository: string;
      branch: string;
      commit: string;
      license: string;
      rights_notice: string;
      status: string;
    };
  };
}

export const projectRoot = process.cwd();

export function readManifest(): SourceManifest {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'data', 'source_manifest.json'), 'utf8'),
  ) as SourceManifest;
}

export function sourceRoot(): string {
  return process.env.PMF_POKEAPI_DATA_PATH
    ? path.resolve(process.env.PMF_POKEAPI_DATA_PATH)
    : path.join(projectRoot, 'data', 'cache', 'pokeapi_api_data');
}

export function databasePath(): string {
  return process.env.PMF_DATABASE_PATH
    ? path.resolve(process.env.PMF_DATABASE_PATH)
    : path.join(projectRoot, 'database', 'generated', 'pokemon.sqlite');
}

export function apiRoot(): string {
  return path.join(sourceRoot(), 'data', 'api', 'v2');
}

export function resourceId(resource: NamedResource | string | null): number {
  const url = typeof resource === 'string' ? resource : resource?.url;
  const match = url?.match(/\/(\d+)\/?$/);
  if (!match) {
    throw new Error(`Cannot find resource id in URL: ${url ?? 'null'}`);
  }
  return Number(match[1]);
}

export function readResources<T>(category: string): T[] {
  const directory = path.join(apiRoot(), category);
  if (!fs.existsSync(directory)) {
    throw new Error(
      `Missing source directory ${directory}. Run npm run data:download first.`,
    );
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .sort((left, right) => Number(left.name) - Number(right.name))
    .map((entry) =>
      JSON.parse(
        fs.readFileSync(path.join(directory, entry.name, 'index.json'), 'utf8'),
      ) as T,
    );
}

export function englishName(
  names: Array<{ name: string; language: NamedResource }> | undefined,
  fallback: string,
): string {
  return (
    names?.find((entry) => entry.language.name === 'en')?.name ??
    humanizeIdentifier(fallback)
  );
}

export function humanizeIdentifier(identifier: string): string {
  return identifier
    .split('-')
    .map((part) => part.length === 0 ? part : part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
