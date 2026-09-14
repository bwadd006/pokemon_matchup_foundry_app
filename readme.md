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

## Development

Install dependencies:

```sh
npm install
```

Download the pinned source snapshot:

```sh
npm run data:download
```

Build the database, import the provisional local images, and then validate the
database:

```sh
npm run data:build
npm run assets:import
npm run data:validate
```

Start the application:

```sh
npm start
```

Create a self-contained package for the current operating system:

```sh
npm run package
```

Run verification:

```sh
npm test
npm run typecheck
```

The generated database, downloaded source cache, provisional images, and build
output are not maintained by hand.
