import { useEffect, useMemo, useState } from 'react';

import type { Generation, PokemonType } from '../../../shared/models/pokedex';
import type {
  TeamAbility,
  TeamBuilderOption,
  TeamMemberSelection,
  TeamSlot,
} from '../../../shared/models/team';
import type { TypeChart } from '../../../shared/models/type_effectiveness';
import { abilitySupport } from '../../../shared/mechanics/ability_effects';
import {
  attackingAbilitySupport,
  calculateTeamMatchupMultiplier,
} from '../../../shared/mechanics/team_matchup';
import {
  compareMultiplier,
  formatMultiplier,
  type ExactMultiplier,
} from '../../../shared/mechanics/type_effectiveness';
import { GenerationSelector } from '../../components/generation_selector';
import { PokemonImage } from '../../components/pokemon_image';
import { PokemonSelector } from '../../components/pokemon_selector';
import { TypeBadge } from '../../components/type_badge';

type AttackDirection = 'opponent' | 'user';

interface TeamEditorProps {
  title: string;
  teamLabel: string;
  slots: TeamSlot[];
  options: TeamBuilderOption[];
  optionByFormId: Map<number, TeamBuilderOption>;
  types: PokemonType[];
  generationId: number;
  onChange: (slots: TeamSlot[]) => void;
}

interface MatchupSlot {
  slotIndex: number;
  selection: TeamMemberSelection | null;
  option: TeamBuilderOption | null;
}

const neutral: ExactMultiplier = { numerator: 1, denominator: 1 };

function selectionFromOption(option: TeamBuilderOption): TeamMemberSelection {
  return {
    formId: option.formId,
    pokemonId: option.pokemonId,
    nationalDexNumber: option.nationalDexNumber,
    identifier: option.identifier,
    name: option.name,
    imagePath: option.imagePath,
    types: option.types,
    ability: null,
    attackingTypeIdentifiers: [null, null, null, null],
  };
}

function currentSelection(
  selection: TeamMemberSelection,
  option: TeamBuilderOption,
): TeamMemberSelection {
  const abilityValid = selection.ability
    ? option.abilities.some((ability) => ability.id === selection.ability?.id)
    : true;
  return {
    ...selection,
    name: option.name,
    imagePath: option.imagePath,
    types: option.types,
    ability: abilityValid ? selection.ability : null,
  };
}


function normalizedAttackTypes(selection: TeamMemberSelection): Array<string | null> {
  return Array.from(
    { length: 4 },
    (_entry, index) => selection.attackingTypeIdentifiers[index] ?? null,
  );
}

function humanize(identifier: string): string {
  return identifier
    .split('-')
    .map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function multiplierKind(multiplier: ExactMultiplier | undefined): string {
  if (!multiplier) return 'unavailable';
  if (multiplier.numerator === 0) return 'immune';
  const comparison = compareMultiplier(multiplier, neutral);
  if (comparison < 0) return 'resisted';
  if (comparison > 0) return 'super_effective';
  return 'neutral';
}

export function TeamMatchupPage({
  generations,
  generationId,
  onGenerationChange,
  userTeamSlots,
  onUserTeamChange,
  opponentTeamSlots,
  onOpponentTeamChange,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
  userTeamSlots: TeamSlot[];
  onUserTeamChange: (slots: TeamSlot[]) => void;
  opponentTeamSlots: TeamSlot[];
  onOpponentTeamChange: (slots: TeamSlot[]) => void;
}) {
  const [options, setOptions] = useState<TeamBuilderOption[]>([]);
  const [chart, setChart] = useState<TypeChart | null>(null);
  const [direction, setDirection] = useState<AttackDirection>('opponent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void Promise.all([
      window.pokemonMatchupFoundry.listTeamBuilderOptions(generationId),
      window.pokemonMatchupFoundry.getTypeChart(generationId),
    ])
      .then(([nextOptions, nextChart]) => {
        setOptions(nextOptions);
        setChart(nextChart);
      })
      .catch((reason: unknown) => {
        setOptions([]);
        setChart(null);
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, [generationId]);

  const optionByFormId = useMemo(
    () => new Map(options.map((option) => [option.formId, option])),
    [options],
  );
  const attackingSlots = direction === 'opponent' ? opponentTeamSlots : userTeamSlots;
  const defendingSlots = direction === 'opponent' ? userTeamSlots : opponentTeamSlots;
  const attackingLabel = direction === 'opponent' ? 'Opponent' : 'Your Team';
  const defendingLabel = direction === 'opponent' ? 'Your Team' : 'Opponent';

  return (
    <main className="team_matchup_page">
      <section className="hero team_matchup_hero">
        <div>
          <p className="section_label">Two-team analysis</p>
          <h2>Compare complete attacking-type coverage</h2>
          <p>
            Add up to four attacking types to each Pokémon, then switch which
            team attacks. Entered types are the final types that hit the defender.
          </p>
        </div>
        <GenerationSelector
          generations={generations}
          generationId={generationId}
          onChange={onGenerationChange}
        />
      </section>

      <TeamEditor
        title="Your Team"
        teamLabel="your team"
        slots={userTeamSlots}
        options={options}
        optionByFormId={optionByFormId}
        types={chart?.types ?? []}
        generationId={generationId}
        onChange={onUserTeamChange}
      />
      <TeamEditor
        title="Opponent"
        teamLabel="opponent"
        slots={opponentTeamSlots}
        options={options}
        optionByFormId={optionByFormId}
        types={chart?.types ?? []}
        generationId={generationId}
        onChange={onOpponentTeamChange}
      />

      <section className="matchup_direction_bar" aria-label="Attack direction">
        <div>
          <span>Active direction</span>
          <strong>{attackingLabel} Attacking</strong>
          <small>{defendingLabel} defending</small>
        </div>
        <button
          type="button"
          onClick={() => setDirection((current) => current === 'opponent' ? 'user' : 'opponent')}
        >
          Switch to {direction === 'opponent' ? 'Your Team' : 'Opponent'} Attacking
        </button>
      </section>

      <section className="type_chart_legend team_matchup_legend" aria-label="Team matchup legend">
        <span className="legend_title">Damage</span>
        <span className="legend_item effectiveness_immune">IMMUNE</span>
        <span className="legend_item effectiveness_resisted">Below 1×</span>
        <span className="legend_item effectiveness_neutral">Blank = 1×</span>
        <span className="legend_item effectiveness_super_effective">Above 1×</span>
      </section>

      <section className="team_matchup_panel" aria-busy={loading}>
        {error ? (
          <div className="error_state">
            <h3>Team Matchup could not be loaded</h3>
            <p>{error}</p>
          </div>
        ) : loading || !chart ? (
          <div className="loading_state">Loading Team Matchup…</div>
        ) : (
          <MatchupTable
            chart={chart}
            attackingSlots={attackingSlots}
            defendingSlots={defendingSlots}
            optionByFormId={optionByFormId}
            attackingLabel={attackingLabel}
            defendingLabel={defendingLabel}
          />
        )}
      </section>
    </main>
  );
}

function TeamEditor({
  title,
  teamLabel,
  slots,
  options,
  optionByFormId,
  types,
  generationId,
  onChange,
}: TeamEditorProps) {
  function updateSlot(slotIndex: number, selection: TeamSlot): void {
    const next = [...slots];
    next[slotIndex] = selection;
    onChange(next);
  }

  function updateMember(slotIndex: number, update: Partial<TeamMemberSelection>): void {
    const member = slots[slotIndex];
    if (!member) return;
    updateSlot(slotIndex, { ...member, ...update });
  }

  function chooseAbility(slotIndex: number, identifier: string): void {
    const member = slots[slotIndex];
    if (!member) return;
    const option = optionByFormId.get(member.formId);
    const ability = option?.abilities.find((entry) => entry.identifier === identifier) ?? null;
    updateMember(slotIndex, { ability });
  }

  function setAttackType(
    slotIndex: number,
    entryIndex: number,
    identifier: string,
  ): void {
    const member = slots[slotIndex];
    if (!member) return;
    const entries = normalizedAttackTypes(member);
    entries[entryIndex] = identifier || null;
    updateMember(slotIndex, { attackingTypeIdentifiers: entries });
  }

  return (
    <section className="matchup_team_editor" aria-label={`${title} editor`}>
      <div className="matchup_team_heading">
        <div>
          <p className="section_label">Team setup</p>
          <h3>{title}</h3>
        </div>
        <span>Up to four attacking types per Pokémon</span>
      </div>
      <div className="team_slots matchup_team_slots">
        {slots.map((selection, slotIndex) => {
          const option = selection ? optionByFormId.get(selection.formId) : undefined;
          const unavailable = Boolean(selection && !option);
          const abilityValid = Boolean(
            selection?.ability &&
            option?.abilities.some((ability) => ability.id === selection.ability?.id),
          );
          const ability = abilityValid ? selection?.ability ?? null : null;
          const defensiveSupport = ability ? abilitySupport(ability.identifier) : 'not_applicable';
          const attackingSupport = ability ? attackingAbilitySupport(ability.identifier) : 'not_applicable';
          const partial = defensiveSupport === 'partially_supported';
          const unmodeled =
            defensiveSupport === 'conditional_unmodeled' ||
            attackingSupport === 'conditional_unmodeled';

          return (
            <article className={`team_slot matchup_team_slot ${unavailable ? 'team_slot_unavailable' : ''}`} key={slotIndex}>
              <div className="team_slot_heading">
                <span>Slot {slotIndex + 1}</span>
                {selection && (
                  <button type="button" onClick={() => updateSlot(slotIndex, null)}>Clear</button>
                )}
              </div>
              {!selection ? (
                <PokemonSelector
                  options={options}
                  onSelect={(selected) => updateSlot(slotIndex, selectionFromOption(selected))}
                />
              ) : (
                <>
                  <div className="team_slot_identity matchup_slot_identity">
                    <PokemonImage imagePath={option?.imagePath ?? selection.imagePath} name={option?.name ?? selection.name} />
                    <div>
                      <strong>{option?.name ?? selection.name}</strong>
                      <small>#{String(selection.nationalDexNumber).padStart(4, '0')}</small>
                      <div className="team_slot_types">
                        {(option?.types ?? selection.types).map((type) => (
                          <TypeBadge key={type.identifier} name={type.name} identifier={type.identifier} compact />
                        ))}
                      </div>
                    </div>
                  </div>
                  {unavailable ? (
                    <p className="slot_warning">Unavailable in Generation {generationId}; excluded from calculations.</p>
                  ) : (
                    <>
                      <label className="ability_selector">
                        <span>Ability</span>
                        <select value={ability?.identifier ?? ''} onChange={(event) => chooseAbility(slotIndex, event.target.value)}>
                          <option value="">—</option>
                          {option!.abilities.map((entry) => (
                            <option key={entry.id} value={entry.identifier}>
                              {entry.name}{entry.isHidden ? ' (Hidden)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selection.ability && !abilityValid && (
                        <p className="slot_warning">That ability is unavailable in Generation {generationId}; no effect is applied.</p>
                      )}
                      {partial && <p className="slot_notice">Type-based effects are applied; conditional effects are not modeled.</p>}
                      {!partial && unmodeled && <p className="slot_notice">This ability depends on battle details, so its effects are not modeled.</p>}
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
                                    onChange={(event) => setAttackType(slotIndex, entryIndex, event.target.value)}
                                  >
                                    <option value="">—</option>
                                    {invalid && <option value={identifier!}>{humanize(identifier!)} (Unavailable)</option>}
                                    {types.map((entry) => <option key={entry.id} value={entry.identifier}>{entry.name}</option>)}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  disabled={!identifier}
                                  aria-label={`Clear Move ${entryIndex + 1} attacking type`}
                                  onClick={() => setAttackType(slotIndex, entryIndex, '')}
                                >
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </fieldset>
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MatchupTable({
  chart,
  attackingSlots,
  defendingSlots,
  optionByFormId,
  attackingLabel,
  defendingLabel,
}: {
  chart: TypeChart;
  attackingSlots: TeamSlot[];
  defendingSlots: TeamSlot[];
  optionByFormId: Map<number, TeamBuilderOption>;
  attackingLabel: string;
  defendingLabel: string;
}) {
  const attackers: MatchupSlot[] = attackingSlots
    .map((selection, slotIndex) => ({
      slotIndex,
      selection,
      option: selection ? optionByFormId.get(selection.formId) ?? null : null,
    }))
    .filter((slot) => slot.selection !== null);
  const defenders: MatchupSlot[] = defendingSlots.map((selection, slotIndex) => ({
    slotIndex,
    selection,
    option: selection ? optionByFormId.get(selection.formId) ?? null : null,
  }));

  return (
    <div className="team_matchup_table_container">
      <table className="team_matchup_table">
        <caption className="visually_hidden">{attackingLabel} attacking {defendingLabel}</caption>
        <thead>
          <tr>
            <th className="matchup_corner" scope="colgroup" colSpan={2}>
              <span>{defendingLabel} →</span>
              <span>{attackingLabel} ↓</span>
            </th>
            {defenders.map((slot) => (
              <DefenderHeader key={slot.slotIndex} slot={slot} />
            ))}
          </tr>
        </thead>
        <tbody>
          {attackers.length === 0 ? (
            <tr>
              <td className="matchup_empty_rows" colSpan={8}>
                Add at least one attacking type to a Pokémon on the active attacking team.
              </td>
            </tr>
          ) : attackers.flatMap((attackerSlot) => {
            const selection = attackerSlot.selection!;
            const attacker = attackerSlot.option
              ? currentSelection(selection, attackerSlot.option)
              : null;
            return normalizedAttackTypes(selection).map((identifier, entryIndex) => {
              const attackingType = identifier
                ? chart.types.find((type) => type.identifier === identifier)
                : undefined;
              return (
                <tr
                  key={`${attackerSlot.slotIndex}-${entryIndex}`}
                  className={`${entryIndex === 0 ? 'matchup_group_start' : ''} ${entryIndex === 3 ? 'matchup_group_end' : ''}`.trim()}
                >
                  {entryIndex === 0 && (
                    <th className="matchup_attacker_header" scope="rowgroup" rowSpan={4}>
                      <PokemonImage imagePath={attackerSlot.option?.imagePath ?? selection.imagePath} name={attackerSlot.option?.name ?? selection.name} />
                      <strong>{attackerSlot.option?.name ?? selection.name}</strong>
                      <small>Slot {attackerSlot.slotIndex + 1}</small>
                      <small>{attackerSlot.option ? (attacker?.ability?.name ?? '—') : 'Unavailable'}</small>
                    </th>
                  )}
                  <th className="matchup_attack_type" scope="row">
                    {attackingType ? (
                      <TypeBadge name={attackingType.name} identifier={attackingType.identifier} compact />
                    ) : identifier ? (
                      <span>{humanize(identifier)}<small>Unavailable</small></span>
                    ) : (
                      <span className="empty_move_label">—</span>
                    )}
                  </th>
                  {defenders.map((defenderSlot) => {
                    const defender = defenderSlot.selection && defenderSlot.option
                      ? currentSelection(defenderSlot.selection, defenderSlot.option)
                      : null;
                    const value = attacker && defender && attackingType
                      ? calculateTeamMatchupMultiplier(chart, attackingType.id, attacker, defender)
                      : undefined;
                    const kind = !identifier
                      ? 'empty'
                      : value
                        ? multiplierKind(value)
                        : defenderSlot.selection && attackerSlot.selection
                          ? 'unavailable'
                          : 'empty';
                    const text = value ? formatMultiplier(value) : '—';
                    const defenderName = defenderSlot.selection?.name ?? `Slot ${defenderSlot.slotIndex + 1}`;
                    const attackName = identifier ? humanize(identifier) : `Move ${entryIndex + 1}`;
                    const description = !identifier
                      ? 'empty attacking type slot'
                      : !defenderSlot.selection
                      ? 'empty defender slot'
                      : !value
                          ? 'unavailable'
                          : value.numerator === 0
                            ? 'immune'
                            : `${value.numerator / value.denominator} times damage`;
                    return (
                      <td
                        key={defenderSlot.slotIndex}
                        className={`matchup_effectiveness_cell effectiveness_${kind}`}
                        title={`${attackName} from ${selection.name} attacking ${defenderName}: ${description}`}
                        aria-label={`${attackName} from ${selection.name} attacking ${defenderName}: ${description}`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

function DefenderHeader({ slot }: { slot: MatchupSlot }) {
  if (!slot.selection) {
    return (
      <th scope="col" className="matchup_defender_header matchup_defender_empty">
        <strong>Slot {slot.slotIndex + 1}</strong>
        <small>Empty</small>
      </th>
    );
  }
  const current = slot.option ? currentSelection(slot.selection, slot.option) : slot.selection;
  return (
    <th scope="col" className="matchup_defender_header">
      <PokemonImage imagePath={current.imagePath} name={current.name} />
      <strong>{current.name}</strong>
      <div className="team_header_types">
        {current.types.map((type) => <TypeBadge key={type.identifier} name={type.name} identifier={type.identifier} compact />)}
      </div>
      <small>{slot.option ? (current.ability?.name ?? '—') : 'Unavailable'}</small>
    </th>
  );
}
