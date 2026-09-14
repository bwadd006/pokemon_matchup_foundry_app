import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { databasePath, projectRoot, readManifest } from '../database/source_data';

interface ImageRow {
  source_url: string;
  relative_path: string;
}

const database = new Database(databasePath(), {
  readonly: true,
  fileMustExist: true,
});

const rows = database
  .prepare(
    'SELECT source_url, relative_path FROM image_assets WHERE source_url IS NOT NULL AND relative_path IS NOT NULL GROUP BY source_url, relative_path ORDER BY relative_path',
  )
  .all() as ImageRow[];
database.close();

const limit = process.env.PMF_ASSET_LIMIT
  ? Number(process.env.PMF_ASSET_LIMIT)
  : rows.length;
const selected = rows.slice(0, Number.isFinite(limit) ? limit : rows.length);
const imageRoot = path.join(projectRoot, 'resources', 'images');
const manifest = readManifest();
const assets: Array<{
  source_url: string;
  relative_path: string;
  bytes: number;
}> = [];

async function download(row: ImageRow): Promise<void> {
  const destination = path.join(imageRoot, row.relative_path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  if (!fs.existsSync(destination)) {
    const response = await fetch(row.source_url);
    if (!response.ok) {
      throw new Error(`${response.status} while downloading ${row.source_url}`);
    }
    const temporary = `${destination}.download`;
    fs.writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
    fs.renameSync(temporary, destination);
  }

  assets.push({
    source_url: row.source_url,
    relative_path: row.relative_path,
    bytes: fs.statSync(destination).size,
  });
}

async function main(): Promise<void> {
const queue = [...selected];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) return;
    try {
      await download(row);
      if (assets.length % 100 === 0) {
        console.log(`Downloaded or verified ${assets.length}/${selected.length} images.`);
      }
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
    }
  }
});

await Promise.all(workers);
assets.sort((left, right) => left.relative_path.localeCompare(right.relative_path));

fs.writeFileSync(
  path.join(projectRoot, 'resources', 'image_manifest.json'),
  JSON.stringify(
    {
      schema_version: 1,
      source: 'pokeapi_sprites',
      source_revision: manifest.sources.pokeapi_sprites.commit,
      status: manifest.sources.pokeapi_sprites.status,
      assets,
    },
    null,
    2,
  ) + '\n',
);

console.log(`Image import complete: ${assets.length}/${selected.length} assets available.`);
}

void main();
