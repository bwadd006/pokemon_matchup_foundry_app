import { useEffect, useMemo, useRef, useState } from 'react';

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
import type {
  SavedTeam,
  TeamPokemonOption,
  TeamSide,
  TeamSlot,
} from '../../shared/models/team';
import {
  activeTeamIsDirty,
  teamIsValidForGeneration,
} from '../../shared/team_persistence';
import type {
  SavedTeamActions,
  SavedTeamBinding,
  TeamIdentityBinding,
} from '../components/saved_team_file_bar';
import { TeamNameDialog } from '../components/saved_team_file_bar';
import {
  TypeCoveragePage,
  type CoverageMode,
} from '../features/type_coverage/type_coverage_page';
import { TeamBuilderPage } from '../features/team_builder/team_builder_page';
import {
  TeamMatchupPage,
  type AttackDirection,
} from '../features/team_matchup/team_matchup_page';
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
    'pokedex' | 'type_chart' | 'team_builder' | 'type_coverage' | 'team_matchup'
  >('pokedex');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationId, setGenerationId] = useState(9);
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [opponentTeamSlots, setOpponentTeamSlots] = useState<TeamSlot[]>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [coverageSide, setCoverageSide] = useState<TeamSide>('user');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('defensive');
  const [matchupDirection, setMatchupDirection] = useState<AttackDirection>('opponent');
  const [userSavedTeam, setUserSavedTeam] = useState<SavedTeam | null>(null);
  const [opponentSavedTeam, setOpponentSavedTeam] = useState<SavedTeam | null>(null);
  const [workflowNameRequest, setWorkflowNameRequest] = useState<{
    side: TeamSide;
    value: string;
  } | null>(null);
  const workflowNameResolver = useRef<((name: string | null) => void) | null>(null);
  const closeWorkflowActive = useRef(false);
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

  useEffect(() => window.pokemonMatchupFoundry.onCloseRequested(() => {
    if (closeWorkflowActive.current || workflowNameResolver.current) return;
    closeWorkflowActive.current = true;
    void (async () => {
      try {
        const userDirty = activeTeamIsDirty(generationId, teamSlots, userSavedTeam);
        const opponentDirty = activeTeamIsDirty(
          generationId,
          opponentTeamSlots,
          opponentSavedTeam,
        );
        if (userDirty && !await protectUnsavedTeam('user', 'close the application')) return;
        if (opponentDirty && !await protectUnsavedTeam('opponent', 'close the application')) return;
        window.pokemonMatchupFoundry.confirmClose();
      } catch (reason) {
        await showError('The application could not save before closing', errorMessage(reason));
      } finally {
        closeWorkflowActive.current = false;
      }
    })();
  }), [generationId, opponentSavedTeam, opponentTeamSlots, teamSlots, userSavedTeam]);

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

  function slotsFor(side: TeamSide): TeamSlot[] {
    return side === 'user' ? teamSlots : opponentTeamSlots;
  }

  function savedTeamFor(side: TeamSide): SavedTeam | null {
    return side === 'user' ? userSavedTeam : opponentSavedTeam;
  }

  function setSlotsFor(side: TeamSide, slots: TeamSlot[]): void {
    if (side === 'user') setTeamSlots(slots);
    else setOpponentTeamSlots(slots);
  }

  function setSavedTeamFor(side: TeamSide, team: SavedTeam | null): void {
    if (side === 'user') setUserSavedTeam(team);
    else setOpponentSavedTeam(team);
  }

  async function saveSide(side: TeamSide): Promise<boolean> {
    const savedTeam = savedTeamFor(side);
    if (!savedTeam) return false;
    const updated = await window.pokemonMatchupFoundry.updateSavedTeam(savedTeam.id, {
      generationId,
      slots: slotsFor(side),
    });
    setSavedTeamFor(side, updated);
    return true;
  }

  async function saveSideAs(side: TeamSide, name: string): Promise<boolean> {
    const created = await window.pokemonMatchupFoundry.createSavedTeam({
      name,
      generationId,
      slots: slotsFor(side),
    });
    setSavedTeamFor(side, created);
    return true;
  }

  function requestTeamName(side: TeamSide): Promise<string | null> {
    return new Promise((resolve) => {
      workflowNameResolver.current = resolve;
      setWorkflowNameRequest({ side, value: '' });
    });
  }

  function finishTeamNameRequest(name: string | null): void {
    const resolve = workflowNameResolver.current;
    workflowNameResolver.current = null;
    setWorkflowNameRequest(null);
    resolve?.(name);
  }

  async function protectUnsavedTeam(side: TeamSide, action: string): Promise<boolean> {
    const slots = slotsFor(side);
    const savedTeam = savedTeamFor(side);
    if (!activeTeamIsDirty(generationId, slots, savedTeam)) return true;
    const role = side === 'user' ? 'Your Team' : 'Opponent Team';
    const choice = await window.pokemonMatchupFoundry.showMessage({
      type: 'warning',
      title: 'Unsaved team',
      message: `${role} has unsaved changes.`,
      detail: `Choose what to do before you ${action}.`,
      buttons: ['Save', `Discard and ${action}`, 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
    if (choice === 0) {
      if (savedTeam) return saveSide(side);
      while (true) {
        const name = await requestTeamName(side);
        if (name === null) return false;
        try {
          return await saveSideAs(side, name);
        } catch (reason) {
          await showError('The team could not be saved', errorMessage(reason));
        }
      }
    }
    return choice === 1;
  }

  async function loadSide(side: TeamSide, requestedTeam: SavedTeam): Promise<boolean> {
    const otherSavedTeam = savedTeamFor(side === 'user' ? 'opponent' : 'user');
    if (otherSavedTeam?.id === requestedTeam.id) {
      await window.pokemonMatchupFoundry.showMessage({
        type: 'info',
        title: 'Team already loaded',
        message: `That team is already loaded as ${side === 'user' ? 'Opponent Team' : 'Your Team'}.`,
        buttons: ['OK'],
        cancelId: 0,
      });
      return false;
    }

    if (requestedTeam.generationId !== generationId) {
      const response = await window.pokemonMatchupFoundry.showMessage({
        type: 'warning',
        title: 'Change generation and load team',
        message: `Load “${requestedTeam.name}” in Generation ${requestedTeam.generationId}?`,
        detail: 'This changes the generation for the entire application and clears both active teams before loading.',
        buttons: ['Continue', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      });
      if (response !== 0) return false;
      if (!await protectUnsavedTeam('user', 'load the other generation')) return false;
      if (!await protectUnsavedTeam('opponent', 'load the other generation')) return false;
      setTeamSlots(Array.from({ length: 6 }, () => null));
      setOpponentTeamSlots(Array.from({ length: 6 }, () => null));
      setUserSavedTeam(null);
      setOpponentSavedTeam(null);
      setGenerationId(requestedTeam.generationId);
    } else if (!await protectUnsavedTeam(side, `load “${requestedTeam.name}”`)) {
      return false;
    }

    const latest = (await window.pokemonMatchupFoundry.listSavedTeams())
      .find((team) => team.id === requestedTeam.id);
    if (!latest) throw new Error('The saved team no longer exists.');
    const options = await window.pokemonMatchupFoundry.listTeamPokemonOptions(
      latest.generationId,
    );
    const optionsByFormId = new Map(options.map((option) => [option.formId, option]));
    setSlotsFor(side, resolveTeamForGeneration(latest.slots, optionsByFormId));
    setSavedTeamFor(side, latest);
    return true;
  }

  async function renameSaved(
    _side: TeamSide,
    team: SavedTeam,
    name: string,
  ): Promise<boolean> {
    const renamed = await window.pokemonMatchupFoundry.renameSavedTeam(team.id, name);
    if (userSavedTeam?.id === renamed.id) setUserSavedTeam(renamed);
    if (opponentSavedTeam?.id === renamed.id) setOpponentSavedTeam(renamed);
    return true;
  }

  async function deleteSaved(_side: TeamSide, team: SavedTeam): Promise<boolean> {
    await window.pokemonMatchupFoundry.deleteSavedTeam(team.id);
    if (userSavedTeam?.id === team.id) setUserSavedTeam(null);
    if (opponentSavedTeam?.id === team.id) setOpponentSavedTeam(null);
    return true;
  }

  function actionsFor(side: TeamSide): SavedTeamActions {
    return {
      save: () => saveSide(side),
      saveNew: (name) => saveSideAs(side, name),
      load: (team) => loadSide(side, team),
      rename: (team, name) => renameSaved(side, team, name),
      delete: (team) => deleteSaved(side, team),
    };
  }

  function bindingFor(side: TeamSide): SavedTeamBinding {
    const savedTeam = savedTeamFor(side);
    return {
      savedTeam,
      otherSavedTeamId: savedTeamFor(side === 'user' ? 'opponent' : 'user')?.id ?? null,
      dirty: activeTeamIsDirty(generationId, slotsFor(side), savedTeam),
      actions: actionsFor(side),
    };
  }

  function identityFor(side: TeamSide): TeamIdentityBinding {
    const savedTeam = savedTeamFor(side);
    return {
      savedTeam,
      dirty: activeTeamIsDirty(generationId, slotsFor(side), savedTeam),
    };
  }

  async function requestGenerationChange(nextGenerationId: number): Promise<void> {
    if (nextGenerationId === generationId) return;
    try {
      const [options, nextChart] = await Promise.all([
        window.pokemonMatchupFoundry.listTeamPokemonOptions(nextGenerationId),
        window.pokemonMatchupFoundry.getTypeChart(nextGenerationId),
      ]);
      const validTypes = new Set(nextChart.types.map((type) => type.identifier));
      const invalidSides = (['user', 'opponent'] as TeamSide[]).filter(
        (side) => !teamIsValidForGeneration(slotsFor(side), options, validTypes),
      );
      if (invalidSides.length > 0) {
        const labels = invalidSides.map((side) => side === 'user' ? 'Your Team' : 'Opponent Team').join(' and ');
        const response = await window.pokemonMatchupFoundry.showMessage({
          type: 'warning',
          title: 'Change generation',
          message: `${labels} contains selections unavailable in Generation ${nextGenerationId}.`,
          detail: `${labels} will be cleared. Fully valid active teams will remain in place.`,
          buttons: ['Clear and Change', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
        });
        if (response !== 0) return;
        for (const side of invalidSides) {
          if (!await protectUnsavedTeam(side, 'change generations')) return;
        }
        for (const side of invalidSides) {
          setSlotsFor(side, Array.from({ length: 6 }, () => null));
          setSavedTeamFor(side, null);
        }
      }
      const optionsByFormId = new Map(options.map((option) => [option.formId, option]));
      for (const side of (['user', 'opponent'] as TeamSide[])) {
        if (invalidSides.includes(side)) continue;
        setSlotsFor(side, resolveTeamForGeneration(slotsFor(side), optionsByFormId));
      }
      setGenerationId(nextGenerationId);
    } catch (reason) {
      await showError('The generation could not be changed', errorMessage(reason));
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
            className={`navigation_item ${activeFeature === 'type_coverage' ? 'navigation_item_active' : ''}`}
            aria-current={activeFeature === 'type_coverage' ? 'page' : undefined}
            onClick={() => setActiveFeature('type_coverage')}
          >
            Type Coverage
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
            onChange={(next) => void requestGenerationChange(next)}
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
          onGenerationChange={(next) => void requestGenerationChange(next)}
        />
      ) : activeFeature === 'team_builder' ? (
        <TeamBuilderPage
          generations={generations}
          generationId={generationId}
          onGenerationChange={(next) => void requestGenerationChange(next)}
          userTeamSlots={teamSlots}
          onUserTeamChange={setTeamSlots}
          opponentTeamSlots={opponentTeamSlots}
          onOpponentTeamChange={setOpponentTeamSlots}
          userPersistence={bindingFor('user')}
          opponentPersistence={bindingFor('opponent')}
        />
      ) : activeFeature === 'type_coverage' ? (
        <TypeCoveragePage
          generations={generations}
          generationId={generationId}
          onGenerationChange={(next) => void requestGenerationChange(next)}
          userTeamSlots={teamSlots}
          opponentTeamSlots={opponentTeamSlots}
          selectedSide={coverageSide}
          onSelectedSideChange={setCoverageSide}
          mode={coverageMode}
          onModeChange={setCoverageMode}
          persistence={identityFor(coverageSide)}
        />
      ) : (
        <TeamMatchupPage
          generations={generations}
          generationId={generationId}
          onGenerationChange={(next) => void requestGenerationChange(next)}
          userTeamSlots={teamSlots}
          opponentTeamSlots={opponentTeamSlots}
          userPersistence={identityFor('user')}
          opponentPersistence={identityFor('opponent')}
          direction={matchupDirection}
          onDirectionChange={setMatchupDirection}
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
      {workflowNameRequest && (
        <TeamNameDialog
          title={`Save ${workflowNameRequest.side === 'user' ? 'Your Team' : 'Opponent Team'}`}
          value={workflowNameRequest.value}
          busy={false}
          error={null}
          onChange={(value) => setWorkflowNameRequest({ ...workflowNameRequest, value })}
          onCancel={() => finishTeamNameRequest(null)}
          onSubmit={() => finishTeamNameRequest(workflowNameRequest.value)}
        />
      )}
    </div>
  );
}

function errorMessage(reason: unknown): string {
  if (!(reason instanceof Error)) return String(reason);
  return reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

async function showError(title: string, detail: string): Promise<void> {
  await window.pokemonMatchupFoundry.showMessage({
    type: 'error',
    title,
    message: title,
    detail,
    buttons: ['OK'],
    cancelId: 0,
  });
}

function resolveTeamForGeneration(
  slots: TeamSlot[],
  optionsByFormId: Map<number, TeamPokemonOption>,
): TeamSlot[] {
  return slots.map((slot) => {
    if (!slot) return null;
    const option = optionsByFormId.get(slot.formId);
    if (!option) return slot;
    const ability = slot.ability
      ? option.abilities.find(
        (candidate) => candidate.identifier === slot.ability?.identifier,
      ) ?? null
      : null;
    return {
      ...slot,
      pokemonId: option.pokemonId,
      nationalDexNumber: option.nationalDexNumber,
      identifier: option.identifier,
      name: option.name,
      imagePath: option.imagePath,
      types: option.types,
      ability,
    };
  });
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
