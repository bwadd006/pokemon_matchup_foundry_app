import { useMemo, useState } from 'react';

import type { SavedTeam, TeamSide, TeamSlot } from '../../shared/models/team';
import { PokemonImage } from './pokemon_image';

type SortField = 'name' | 'generation' | 'created' | 'modified';

export interface SavedTeamActions {
  save(): Promise<boolean>;
  saveNew(name: string): Promise<boolean>;
  load(team: SavedTeam): Promise<boolean>;
  rename(team: SavedTeam, name: string): Promise<boolean>;
  delete(team: SavedTeam): Promise<boolean>;
}

export interface SavedTeamBinding {
  savedTeam: SavedTeam | null;
  otherSavedTeamId: string | null;
  dirty: boolean;
  actions: SavedTeamActions;
}

export interface TeamIdentityBinding {
  savedTeam: SavedTeam | null;
  dirty: boolean;
}

export function teamRoleLabel(side: TeamSide): string {
  return side === 'user' ? 'Your Team' : 'Opponent Team';
}

export function activeTeamHeading(
  side: TeamSide,
  savedTeam: SavedTeam | null,
): string {
  const role = teamRoleLabel(side);
  return savedTeam ? `${role} — ${savedTeam.name}` : role;
}

export function activeTeamStatus(binding: TeamIdentityBinding): string | null {
  if (!binding.dirty) return null;
  return binding.savedTeam ? 'Unsaved changes' : 'Unsaved team';
}

export function SavedTeamFileBar({
  side,
  generationId,
  slots,
  savedTeam,
  otherSavedTeamId,
  dirty,
  actions,
}: {
  side: TeamSide;
  generationId: number;
  slots: TeamSlot[];
  savedTeam: SavedTeam | null;
  otherSavedTeamId: string | null;
  dirty: boolean;
  actions: SavedTeamActions;
}) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [nameDialog, setNameDialog] = useState<
    { mode: 'new'; value: string } | { mode: 'rename'; value: string; team: SavedTeam } | null
  >(null);
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPokemon = slots.some((slot) => slot !== null);
  const role = teamRoleLabel(side);

  async function refreshTeams(): Promise<void> {
    setError(null);
    try {
      setTeams(await window.pokemonMatchupFoundry.listSavedTeams());
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function openBrowser(): Promise<void> {
    setBrowserOpen(true);
    await refreshTeams();
  }

  async function run(
    operation: () => Promise<boolean>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const succeeded = await operation();
      if (succeeded) setMessage(successMessage);
      return succeeded;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitName(): Promise<void> {
    if (!nameDialog) return;
    const operation = nameDialog.mode === 'new'
      ? () => actions.saveNew(nameDialog.value)
      : () => actions.rename(nameDialog.team, nameDialog.value);
    const succeeded = await run(
      operation,
      nameDialog.mode === 'new' ? 'Team saved.' : 'Team renamed.',
    );
    if (!succeeded) return;
    setNameDialog(null);
    if (browserOpen) await refreshTeams();
  }

  async function load(team: SavedTeam): Promise<void> {
    const succeeded = await run(
      () => actions.load(team),
      `${team.name} loaded as ${role}.`,
    );
    if (succeeded) setBrowserOpen(false);
  }

  async function remove(team: SavedTeam): Promise<void> {
    const response = await window.pokemonMatchupFoundry.showMessage({
      type: 'warning',
      title: 'Delete saved team',
      message: `Delete “${team.name}”?`,
      detail: 'The saved record cannot be recovered. A currently active copy will remain as an unsaved team.',
      buttons: ['Delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });
    if (response !== 0) return;
    const succeeded = await run(
      () => actions.delete(team),
      `${team.name} deleted.`,
    );
    if (succeeded) await refreshTeams();
  }

  return (
    <>
      <div className="saved_team_file_bar" aria-label={`${role} saved-team controls`}>
        <div className="saved_team_status" aria-live="polite">
          <strong>{savedTeam ? `Saved as ${savedTeam.name}` : 'Not saved'}</strong>
          {dirty && (
            <span>{savedTeam ? 'Unsaved changes' : 'Unsaved team'}</span>
          )}
        </div>
        <div className="saved_team_actions">
          <button type="button" disabled={busy} onClick={() => void openBrowser()}>
            Load
          </button>
          <button
            type="button"
            disabled={busy || !hasPokemon}
            onClick={() => {
              setError(null);
              setNameDialog({ mode: 'new', value: savedTeam ? `${savedTeam.name} Copy` : '' });
            }}
          >
            Save New
          </button>
          <button
            type="button"
            disabled={busy || !hasPokemon || !savedTeam}
            onClick={() => void run(actions.save, 'Team saved.')}
          >
            Save
          </button>
        </div>
      </div>
      {message && (
        <div className="saved_team_notice" role="status">
          <span>{message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      {error && !browserOpen && !nameDialog && (
        <div className="saved_team_error" role="alert">{error}</div>
      )}
      {browserOpen && (
        <SavedTeamBrowser
          targetSide={side}
          teams={teams}
          activeSavedTeamId={savedTeam?.id ?? null}
          otherSavedTeamId={otherSavedTeamId}
          busy={busy}
          error={error}
          onClose={() => {
            setBrowserOpen(false);
            setError(null);
          }}
          onLoad={(team) => void load(team)}
          onRename={(team) => {
            setError(null);
            setNameDialog({ mode: 'rename', value: team.name, team });
          }}
          onDelete={(team) => void remove(team)}
        />
      )}
      {nameDialog && (
        <TeamNameDialog
          title={nameDialog.mode === 'new' ? `Save ${role} as a new team` : `Rename ${nameDialog.team.name}`}
          value={nameDialog.value}
          busy={busy}
          error={error}
          onChange={(value) => setNameDialog({ ...nameDialog, value })}
          onCancel={() => {
            setNameDialog(null);
            setError(null);
          }}
          onSubmit={() => void submitName()}
        />
      )}
      <span className="visually_hidden">
        Generation {generationId}; {hasPokemon ? 'team has Pokémon' : 'team is empty'}
      </span>
    </>
  );
}

function SavedTeamBrowser({
  targetSide,
  teams,
  activeSavedTeamId,
  otherSavedTeamId,
  busy,
  error,
  onClose,
  onLoad,
  onRename,
  onDelete,
}: {
  targetSide: TeamSide;
  teams: SavedTeam[];
  activeSavedTeamId: string | null;
  otherSavedTeamId: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onLoad: (team: SavedTeam) => void;
  onRename: (team: SavedTeam) => void;
  onDelete: (team: SavedTeam) => void;
}) {
  const [nameSearch, setNameSearch] = useState('');
  const [pokemonSearch, setPokemonSearch] = useState('');
  const [generation, setGeneration] = useState('');
  const [modifiedAfter, setModifiedAfter] = useState('');
  const [modifiedBefore, setModifiedBefore] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const otherRole = teamRoleLabel(targetSide === 'user' ? 'opponent' : 'user');

  const visibleTeams = useMemo(() => {
    const normalizedName = nameSearch.trim().toLocaleLowerCase();
    const normalizedPokemon = pokemonSearch.trim().toLocaleLowerCase();
    const after = modifiedAfter ? new Date(`${modifiedAfter}T00:00:00`).getTime() : null;
    const before = modifiedBefore ? new Date(`${modifiedBefore}T23:59:59.999`).getTime() : null;
    return teams
      .filter((team) => !normalizedName || team.name.toLocaleLowerCase().includes(normalizedName))
      .filter((team) => !normalizedPokemon || team.slots.some((slot) =>
        slot && [slot.name, slot.identifier]
          .some((value) => value.toLocaleLowerCase().includes(normalizedPokemon))))
      .filter((team) => !generation || team.generationId === Number(generation))
      .filter((team) => after === null || new Date(team.updatedAt).getTime() >= after)
      .filter((team) => before === null || new Date(team.updatedAt).getTime() <= before)
      .sort((left, right) => {
        let comparison: number;
        if (sortField === 'name') comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        else if (sortField === 'generation') comparison = left.generationId - right.generationId;
        else if (sortField === 'created') comparison = left.createdAt.localeCompare(right.createdAt);
        else comparison = left.updatedAt.localeCompare(right.updatedAt);
        if (comparison === 0) comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        return sortDirection === 'ascending' ? comparison : -comparison;
      });
  }, [generation, modifiedAfter, modifiedBefore, nameSearch, pokemonSearch, sortDirection, sortField, teams]);

  return (
    <div className="saved_team_modal_backdrop" role="presentation">
      <section className="saved_team_modal saved_team_browser" role="dialog" aria-modal="true" aria-labelledby="saved-team-browser-title">
        <header>
          <div>
            <p className="section_label">Saved teams</p>
            <h3 id="saved-team-browser-title">Load into {teamRoleLabel(targetSide)}</h3>
          </div>
          <button type="button" className="modal_close" aria-label="Close saved-team browser" onClick={onClose}>×</button>
        </header>
        <div className="saved_team_filters">
          <label><span>Team name</span><input autoFocus type="search" value={nameSearch} onChange={(event) => setNameSearch(event.target.value)} /></label>
          <label><span>Pokémon</span><input type="search" value={pokemonSearch} onChange={(event) => setPokemonSearch(event.target.value)} /></label>
          <label><span>Generation</span><select value={generation} onChange={(event) => setGeneration(event.target.value)}><option value="">All</option>{Array.from({ length: 9 }, (_entry, index) => <option key={index + 1} value={index + 1}>Generation {index + 1}</option>)}</select></label>
          <label><span>Modified after</span><input type="date" value={modifiedAfter} onChange={(event) => setModifiedAfter(event.target.value)} /></label>
          <label><span>Modified before</span><input type="date" value={modifiedBefore} onChange={(event) => setModifiedBefore(event.target.value)} /></label>
          <label><span>Sort</span><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="name">Team name</option><option value="generation">Generation</option><option value="created">Created</option><option value="modified">Last modified</option></select></label>
          <label><span>Direction</span><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'ascending' | 'descending')}><option value="ascending">Ascending</option><option value="descending">Descending</option></select></label>
        </div>
        {error && <div className="saved_team_error" role="alert">{error}</div>}
        <div className="saved_team_results" aria-live="polite">
          {teams.length === 0 ? (
            <p className="saved_team_empty">No saved teams yet.</p>
          ) : visibleTeams.length === 0 ? (
            <p className="saved_team_empty">No saved teams match these filters.</p>
          ) : visibleTeams.map((team) => {
            const loadedElsewhere = team.id === otherSavedTeamId;
            const loadedHere = team.id === activeSavedTeamId;
            return (
              <article className="saved_team_result" key={team.id}>
                <div className="saved_team_result_heading">
                  <div><strong>{team.name}</strong><span>Generation {team.generationId}</span></div>
                  <small>Modified {new Date(team.updatedAt).toLocaleString()}</small>
                </div>
                <div className="saved_team_preview" aria-label={`${team.name} slots`}>
                  {team.slots.map((slot, index) => (
                    <div key={index} title={slot?.name ?? `Empty Slot ${index + 1}`}>
                      {slot ? <><PokemonImage imagePath={slot.imagePath} name={slot.name} /><span>{slot.name}</span></> : <span className="saved_team_preview_empty">—</span>}
                    </div>
                  ))}
                </div>
                <div className="saved_team_result_actions">
                  {loadedElsewhere && <span>Currently loaded as {otherRole}</span>}
                  {loadedHere && <span>Currently loaded here</span>}
                  <button type="button" disabled={busy || loadedElsewhere} onClick={() => onLoad(team)}>{loadedHere ? 'Reload' : 'Load'}</button>
                  <button type="button" disabled={busy} onClick={() => onRename(team)}>Rename</button>
                  <button type="button" disabled={busy} className="danger_button" onClick={() => onDelete(team)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function TeamNameDialog({
  title,
  value,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  value: string;
  busy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="saved_team_modal_backdrop" role="presentation">
      <form className="saved_team_modal saved_team_name_dialog" role="dialog" aria-modal="true" aria-labelledby="saved-team-name-title" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <header><h3 id="saved-team-name-title">{title}</h3></header>
        <label><span>Team name</span><input autoFocus maxLength={80} value={value} onChange={(event) => onChange(event.target.value)} /></label>
        {error && <div className="saved_team_error" role="alert">{error}</div>}
        <footer>
          <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={busy}>Save</button>
        </footer>
      </form>
    </div>
  );
}

function errorMessage(reason: unknown): string {
  if (!(reason instanceof Error)) return String(reason);
  return reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}
