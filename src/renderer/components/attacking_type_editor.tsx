import type { PokemonType } from '../../shared/models/pokedex';
import type { TeamMemberSelection } from '../../shared/models/team';
import { normalizedAttackTypes } from '../../shared/team_slots';

export function humanizeTypeIdentifier(identifier: string): string {
  return identifier
    .split('-')
    .map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export function AttackingTypeEditor({
  selection,
  types,
  teamLabel,
  onChange,
}: {
  selection: TeamMemberSelection;
  types: PokemonType[];
  teamLabel: string;
  onChange: (attackingTypeIdentifiers: Array<string | null>) => void;
}) {
  function setEntry(entryIndex: number, identifier: string): void {
    const entries = normalizedAttackTypes(selection);
    entries[entryIndex] = identifier || null;
    onChange(entries);
  }

  return (
    <fieldset className="attack_type_editor">
      <legend>Attacking types</legend>
      <ol>
        {normalizedAttackTypes(selection).map((identifier, entryIndex) => {
          const type = identifier
            ? types.find((entry) => entry.identifier === identifier)
            : undefined;
          const invalid = Boolean(identifier && !type);
          return (
            <li key={entryIndex} className={invalid ? 'attack_type_invalid' : ''}>
              <label>
                <span>Move {entryIndex + 1}</span>
                <select
                  value={identifier ?? ''}
                  aria-label={`Move ${entryIndex + 1} attacking type for ${selection.name} on ${teamLabel}`}
                  onChange={(event) => setEntry(entryIndex, event.target.value)}
                >
                  <option value="">—</option>
                  {invalid && (
                    <option value={identifier!}>
                      {humanizeTypeIdentifier(identifier!)} (Unavailable)
                    </option>
                  )}
                  {types.map((entry) => (
                    <option key={entry.id} value={entry.identifier}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!identifier}
                aria-label={`Clear Move ${entryIndex + 1} attacking type`}
                onClick={() => setEntry(entryIndex, '')}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
