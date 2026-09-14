import { useEffect, useMemo, useState } from 'react';

import type {
  DatasetInformation,
  FormCategory,
  Generation,
  PokedexRow,
  PokemonType,
} from '../../shared/models/pokedex';
import { GenerationSelector } from '../components/generation_selector';
import { PokemonImage } from '../components/pokemon_image';
import { TypeBadge } from '../components/type_badge';
import type { TeamSlot } from '../../shared/models/team';
import { TeamBuilderPage } from '../features/team_builder/team_builder_page';
import { TeamMatchupPage } from '../features/team_matchup/team_matchup_page';
import { TypeChartPage } from '../features/type_chart/type_chart_page';

type SortKey =
  | 'number'
  | 'name'
  | 'hp'
  | 'attack'
  | 'defense'
  | 'special'
  | 'specialAttack'
  | 'specialDefense'
  | 'speed'
  | 'bst';

const categoryLabels: Record<FormCategory, string> = {
  standard: 'Standard',
  cosmetic: 'Cosmetic',
  transformation: 'Transformations',
  battle_only: 'Battle-only',
};

function sortableValue(row: PokedexRow, key: SortKey): string | number {
  if (key === 'number') return row.nationalDexNumber;
  if (key === 'name') return row.name;
  return row[key] ?? -1;
}

export function Application() {
  const [activeFeature, setActiveFeature] = useState<
    'pokedex' | 'type_chart' | 'team_builder' | 'team_matchup'
  >('pokedex');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationId, setGenerationId] = useState(9);
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [opponentTeamSlots, setOpponentTeamSlots] = useState<TeamSlot[]>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [types, setTypes] = useState<PokemonType[]>([]);
  const [rows, setRows] = useState<PokedexRow[]>([]);
  const [dataset, setDataset] = useState<DatasetInformation | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Set<FormCategory>>(
    new Set(['standard']),
  );
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>(
    'ascending',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      window.pokemonMatchupFoundry.listGenerations(),
      window.pokemonMatchupFoundry.datasetInformation(),
    ])
      .then(([generationRows, information]) => {
        setGenerations(generationRows);
        setDataset(information);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedTypes(new Set());

    void Promise.all([
      window.pokemonMatchupFoundry.listTypes(generationId),
      window.pokemonMatchupFoundry.listPokedexRows(generationId),
    ])
      .then(([typeRows, pokedexRows]) => {
        setTypes(typeRows);
        setRows(pokedexRows);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, [generationId]);

  const visibleRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const selected = [...selectedTypes];

    return rows
      .filter((row) => categories.has(row.category))
      .filter(
        (row) =>
          selected.length === 0 ||
          selected.some(
            (type) =>
              row.typeOneIdentifier === type || row.typeTwoIdentifier === type,
          ),
      )
      .filter((row) => {
        if (!normalizedSearch) return true;
        return [
          row.name,
          row.identifier,
          row.abilityOne,
          row.abilityTwo,
          row.hiddenAbility,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftValue = sortableValue(left, sortKey);
        const rightValue = sortableValue(right, sortKey);
        let comparison =
          typeof leftValue === 'string' && typeof rightValue === 'string'
            ? leftValue.localeCompare(rightValue)
            : Number(leftValue) - Number(rightValue);

        if (comparison === 0) {
          comparison = left.nationalDexNumber - right.nationalDexNumber;
        }
        if (comparison === 0) comparison = left.formId - right.formId;
        return sortDirection === 'ascending' ? comparison : -comparison;
      });
  }, [categories, rows, search, selectedTypes, sortDirection, sortKey]);

  function toggleType(identifier: string): void {
    setSelectedTypes((current) => {
      const next = new Set(current);
      if (next.has(identifier)) next.delete(identifier);
      else next.add(identifier);
      return next;
    });
  }

  function toggleCategory(category: FormCategory): void {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function chooseSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDirection((current) =>
        current === 'ascending' ? 'descending' : 'ascending',
      );
    } else {
      setSortKey(key);
      setSortDirection('ascending');
    }
  }

  const generationOne = generationId === 1;

  return (
    <div className="application_shell">
      <header className="application_header">
        <div>
          <p className="eyebrow">Unofficial fan project</p>
          <h1>Pokémon Matchup Foundry</h1>
        </div>
        <nav aria-label="Application features">
          <button
            type="button"
            className={`navigation_item ${activeFeature === 'pokedex' ? 'navigation_item_active' : ''}`}
            aria-current={activeFeature === 'pokedex' ? 'page' : undefined}
            onClick={() => setActiveFeature('pokedex')}
          >
            Pokédex
          </button>
          <button
            type="button"
            className={`navigation_item ${activeFeature === 'type_chart' ? 'navigation_item_active' : ''}`}
            aria-current={activeFeature === 'type_chart' ? 'page' : undefined}
            onClick={() => setActiveFeature('type_chart')}
          >
            Type Chart
          </button>
          <button
            type="button"
            className={`navigation_item ${activeFeature === 'team_builder' ? 'navigation_item_active' : ''}`}
            aria-current={activeFeature === 'team_builder' ? 'page' : undefined}
            onClick={() => setActiveFeature('team_builder')}
          >
            Team Builder
          </button>
          <button
            type="button"
            className={`navigation_item ${activeFeature === 'team_matchup' ? 'navigation_item_active' : ''}`}
            aria-current={activeFeature === 'team_matchup' ? 'page' : undefined}
            onClick={() => setActiveFeature('team_matchup')}
          >
            Team Matchup
          </button>
        </nav>
      </header>

      {activeFeature === 'pokedex' ? (
      <main>
        <section className="hero">
          <div>
            <p className="section_label">National Pokédex</p>
            <h2>Explore Pokémon through every generation</h2>
            <p>
              Browse historical types, base stats, and abilities from the
              application’s local reference database.
            </p>
          </div>
          <GenerationSelector
            generations={generations}
            generationId={generationId}
            onChange={setGenerationId}
          />
        </section>

        <section className="controls_panel" aria-label="Pokédex controls">
          <label className="search_control">
            <span>Search Pokémon or abilities</span>
            <input
              type="search"
              value={search}
              placeholder="Try Gengar or Levitate"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <fieldset className="category_filters">
            <legend>Forms</legend>
            <div>
              {(Object.keys(categoryLabels) as FormCategory[]).map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={categories.has(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  <span>{categoryLabels[category]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="filter_actions">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedTypes(new Set());
                setCategories(new Set(['standard']));
                setSortKey('number');
                setSortDirection('ascending');
              }}
            >
              Reset filters
            </button>
          </div>
        </section>

        <section className="type_filters" aria-label="Filter by type">
          <span>Types</span>
          <div>
            {types.map((type) => (
              <button
                type="button"
                key={type.identifier}
                className={selectedTypes.has(type.identifier) ? 'selected' : ''}
                aria-pressed={selectedTypes.has(type.identifier)}
                onClick={() => toggleType(type.identifier)}
              >
                <TypeBadge name={type.name} identifier={type.identifier} compact />
              </button>
            ))}
          </div>
        </section>

        <section className="pokedex_panel">
          <div className="table_summary" aria-live="polite">
            <strong>{visibleRows.length.toLocaleString()}</strong>
            <span>{visibleRows.length === 1 ? 'entry' : 'entries'}</span>
            {dataset && (
              <span className={`dataset_status dataset_status_${dataset.validationStatus}`}>
                Database {dataset.validationStatus}
              </span>
            )}
          </div>

          {error ? (
            <div className="error_state">
              <h3>The Pokédex could not be loaded</h3>
              <p>{error}</p>
              <p>Build and validate the local database, then restart the app.</p>
            </div>
          ) : loading ? (
            <div className="loading_state">Loading Pokédex…</div>
          ) : visibleRows.length === 0 ? (
            <div className="empty_state">
              No Pokémon match the current search and filters.
            </div>
          ) : (
            <div className="table_scroller">
              <table>
                <thead>
                  <tr>
                    <SortableHeader
                      label="#"
                      active={sortKey === 'number'}
                      direction={sortDirection}
                      onClick={() => chooseSort('number')}
                    />
                    <th scope="col">Pokémon</th>
                    <SortableHeader
                      label="Name"
                      active={sortKey === 'name'}
                      direction={sortDirection}
                      onClick={() => chooseSort('name')}
                    />
                    <th scope="col">Type</th>
                    <SortableHeader label="HP" active={sortKey === 'hp'} direction={sortDirection} onClick={() => chooseSort('hp')} />
                    <SortableHeader label="Atk" active={sortKey === 'attack'} direction={sortDirection} onClick={() => chooseSort('attack')} />
                    <SortableHeader label="Def" active={sortKey === 'defense'} direction={sortDirection} onClick={() => chooseSort('defense')} />
                    {generationOne ? (
                      <SortableHeader label="Spc" active={sortKey === 'special'} direction={sortDirection} onClick={() => chooseSort('special')} />
                    ) : (
                      <>
                        <SortableHeader label="Sp. Atk" active={sortKey === 'specialAttack'} direction={sortDirection} onClick={() => chooseSort('specialAttack')} />
                        <SortableHeader label="Sp. Def" active={sortKey === 'specialDefense'} direction={sortDirection} onClick={() => chooseSort('specialDefense')} />
                      </>
                    )}
                    <SortableHeader label="Spe" active={sortKey === 'speed'} direction={sortDirection} onClick={() => chooseSort('speed')} />
                    <SortableHeader label="BST" active={sortKey === 'bst'} direction={sortDirection} onClick={() => chooseSort('bst')} />
                    <th scope="col">Ability 1</th>
                    <th scope="col">Ability 2</th>
                    <th scope="col">Hidden Ability</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.formId}>
                      <td className="dex_number">
                        #{String(row.nationalDexNumber).padStart(4, '0')}
                      </td>
                      <td className="image_cell">
                        <PokemonImage imagePath={row.imagePath} name={row.name} />
                      </td>
                      <th scope="row" className="pokemon_name">
                        <span>{row.name}</span>
                        {row.category !== 'standard' && (
                          <small>{categoryLabels[row.category]}</small>
                        )}
                      </th>
                      <td>
                        <div className="type_stack">
                          {row.typeOne && row.typeOneIdentifier && (
                            <TypeBadge name={row.typeOne} identifier={row.typeOneIdentifier} />
                          )}
                          {row.typeTwo && row.typeTwoIdentifier ? (
                            <TypeBadge name={row.typeTwo} identifier={row.typeTwoIdentifier} />
                          ) : (
                            <span className="missing_value" aria-label="No secondary type">—</span>
                          )}
                        </div>
                      </td>
                      <StatCell value={row.hp} />
                      <StatCell value={row.attack} />
                      <StatCell value={row.defense} />
                      {generationOne ? (
                        <StatCell value={row.special} />
                      ) : (
                        <>
                          <StatCell value={row.specialAttack} />
                          <StatCell value={row.specialDefense} />
                        </>
                      )}
                      <StatCell value={row.speed} />
                      <td className="bst_value">{row.bst}</td>
                      <AbilityCell value={row.abilityOne} />
                      <AbilityCell value={row.abilityTwo} />
                      <AbilityCell value={row.hiddenAbility} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      ) : activeFeature === 'type_chart' ? (
        <TypeChartPage
          generations={generations}
          generationId={generationId}
          onGenerationChange={setGenerationId}
        />
      ) : activeFeature === 'team_builder' ? (
        <TeamBuilderPage
          generations={generations}
          generationId={generationId}
          onGenerationChange={setGenerationId}
          teamSlots={teamSlots}
          onTeamSlotsChange={setTeamSlots}
        />
      ) : (
        <TeamMatchupPage
          generations={generations}
          generationId={generationId}
          onGenerationChange={setGenerationId}
          userTeamSlots={teamSlots}
          onUserTeamChange={setTeamSlots}
          opponentTeamSlots={opponentTeamSlots}
          onOpponentTeamChange={setOpponentTeamSlots}
        />
      )}

      <footer>
        <span>Unofficial and independent. Pokémon belongs to its respective rights holders.</span>
        {dataset && (
          <span title={dataset.sourceCommit}>
            Data {dataset.sourceCommit.slice(0, 8)}
          </span>
        )}
      </footer>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'ascending' | 'descending';
  onClick: () => void;
}) {
  return (
    <th scope="col" aria-sort={active ? direction : 'none'}>
      <button type="button" className="sort_button" onClick={onClick}>
        {label}
        <span aria-hidden="true">{active ? (direction === 'ascending' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}

function StatCell({ value }: { value: number | null }) {
  return <td className="stat_value">{value ?? <span className="missing_value">—</span>}</td>;
}

function AbilityCell({ value }: { value: string | null }) {
  return <td className="ability_value">{value ?? <span className="missing_value">—</span>}</td>;
}
