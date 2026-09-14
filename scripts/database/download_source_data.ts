import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { readManifest, sourceRoot } from './source_data';

function runGit(args: string[], cwd?: string): void {
  const result = spawnSync('git', args, {
    cwd,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with status ${result.status}`);
  }
}

const manifest = readManifest();
const source = manifest.sources.pokeapi_api_data;
const destination = sourceRoot();

fs.mkdirSync(path.dirname(destination), { recursive: true });

if (!fs.existsSync(path.join(destination, '.git'))) {
  fs.mkdirSync(destination, { recursive: true });
  runGit(['init'], destination);
  runGit(['remote', 'add', 'origin', source.repository], destination);
}

runGit(['fetch', '--depth=1', 'origin', source.commit], destination);
runGit(['sparse-checkout', 'init', '--cone'], destination);
runGit(['sparse-checkout', 'set', ...source.directories], destination);
runGit(['checkout', '--detach', source.commit], destination);

const actual = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: destination,
  encoding: 'utf8',
});
if (actual.status !== 0 || actual.stdout.trim() !== source.commit) {
  throw new Error('Downloaded source revision does not match source_manifest.json.');
}

console.log(`PokéAPI source ready at ${destination}`);
console.log(`Pinned revision: ${source.commit}`);
