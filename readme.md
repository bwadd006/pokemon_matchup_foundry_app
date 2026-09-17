# Pokémon Matchup Foundry

Pokémon Matchup Foundry is an unofficial desktop application for exploring
generation-specific Pokémon data and matchups. It is not affiliated with or
endorsed by Nintendo, The Pokémon Company, Game Freak, Creatures Inc.,
Marriland, or PokéAPI.

## Alpha Scope

The current alpha builds a versioned SQLite reference database from a pinned
PokéAPI data snapshot and uses it for a generation-aware National Pokédex,
single-type effectiveness chart, dedicated Team Builder, six-slot Type
Coverage, and bidirectional Team Matchup analysis with supported attacker and
defender ability effects. Team Builder manages both active teams and can
create, update, find, load, rename, and delete persistent named teams stored
locally for the current operating-system user. Type Coverage and Team Matchup
read those shared teams without duplicating their edit controls.

Type Coverage includes Defensive Coverage and Offensive Coverage page modes.
The offensive mode shows all six team-slot groups with four attack-type rows
each against individual defending types. Team Matchup uses the same fixed
six-by-four attacking layout in either direction.

The interface uses a compact responsive density on maximized 1920×1080
displays. The complete Generation IX Type Chart and all 18 Offensive Coverage
defending-type columns fit without whole-page horizontal scrolling. On
narrower windows, wide analysis tables provide their own horizontal scrolling
while vertical wheel input over those tables continues to scroll the page.

Team Builder appears between Type Chart and Type Coverage, displays Your Team
and Opponent Team simultaneously, and centralizes Pokémon, ability,
attacking-type, and saved-team editing. Type Coverage and Team Matchup are
read-only analysis pages that retain their generation and analysis-direction
controls.

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

Portable ZIP builds are independent of the build host: use `--platform` and
`--arch` to target Windows or Linux from either operating system. The project
packages the corresponding Electron runtime and `better-sqlite3` prebuilt
binary for the selected target. A Windows x64 ZIP built on Linux was verified
and successfully run on Windows on September 15, 2026.

The ZIP contains the Electron runtime, application, database, images, and
native dependencies; the recipient does not need Node.js or the source
repository. The recipient must extract the complete archive before launching
the executable. Test each archive on its target operating system before a
public release; generating an archive on another OS does not run or sign the
target executable.

To build the 64-bit Windows ZIP from Windows PowerShell or a Linux shell, run:

```powershell
npx electron-forge make --platform win32 --arch x64 --targets "@electron-forge/maker-zip"
```

The archive is written under `out/make/zip/win32/x64/`. After extraction, run
`pokemon_matchup_foundry.exe`.

To build the 64-bit Linux ZIP from Linux or Windows PowerShell, run:

```sh
npx electron-forge make --platform linux --arch x64 --targets "@electron-forge/maker-zip"
```

The archive is written under `out/make/zip/linux/x64/`. After extraction, run
the `pokemon_matchup_foundry` executable.

These cross-platform instructions apply to the portable ZIP maker. Installers,
code signing, and notarization may require target-specific tools or a native
CI runner.

The generated database, downloaded source cache, provisional images,
dependencies, and build output are not maintained by hand.
