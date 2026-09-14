# Pokémon Matchup Foundry

Pokémon Matchup Foundry is an unofficial desktop application for exploring
generation-specific Pokémon data and matchups. It is not affiliated with or
endorsed by Nintendo, The Pokémon Company, Game Freak, Creatures Inc.,
Marriland, or PokéAPI.

## Alpha Scope

The current alpha builds a versioned SQLite reference database from a pinned
PokéAPI data snapshot and uses it for a generation-aware National Pokédex,
single-type effectiveness chart, six-slot defensive Team Builder, and
bidirectional Team Matchup analysis with supported attacker and defender
ability effects.

## Requirements

- Node.js 22 or newer, with npm
- Git

Linux development also requires Python 3, `make`, and a C++ compiler so
Electron Forge can prepare native dependencies. On Debian or Ubuntu, install
those system tools with:

```sh
sudo apt install git python3 make g++
```

## Run on Windows

Install Node.js LTS and Git, then open a new PowerShell window so the updated
`PATH` is available. From the repository directory, run:

```powershell
npm ci
npm run data:download
npm run data:build
npm run assets:import
npm run data:validate
npm test
npm run typecheck
npm start
```

## Run on Linux

After installing Node.js, Git, Python 3, `make`, and a C++ compiler, run from
the repository directory:

```sh
npm ci
npm run data:download
npm run data:build
npm run assets:import
npm run data:validate
npm test
npm run typecheck
npm start
```

## Build Portable ZIP Archives

Build each archive on its target operating system. The ZIP contains the
Electron runtime, application, database, images, and native dependencies; the
recipient does not need Node.js or the source repository. The recipient must
extract the complete archive before launching the executable.

On 64-bit Windows, run in PowerShell:

```powershell
npx electron-forge make --platform win32 --arch x64 --targets "@electron-forge/maker-zip"
```

The archive is written under `out/make/zip/win32/x64/`. After extraction, run
`pokemon_matchup_foundry.exe`.

On 64-bit Linux, run:

```sh
npx electron-forge make --platform linux --arch x64 --targets @electron-forge/maker-zip
```

The archive is written under `out/make/zip/linux/x64/`. After extraction, run
the `pokemon_matchup_foundry` executable.

The generated database, downloaded source cache, provisional images,
dependencies, and build output are not maintained by hand.
