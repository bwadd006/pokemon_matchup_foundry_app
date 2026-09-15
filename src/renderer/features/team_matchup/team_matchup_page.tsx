import { useEffect, useMemo, useState } from 'react';

import type { Generation } from '../../../shared/models/pokedex';
import type {
  TeamMemberSelection,
  TeamPokemonOption,
  TeamSlot,
} from '../../../shared/models/team';
import type { TypeChart } from '../../../shared/models/type_effectiveness';
import { fixedAttackingSlots, normalizedAttackTypes } from '../../../shared/team_slots';
import { calculateTeamMatchupMultiplier } from '../../../shared/mechanics/attacking_coverage';
import {
  compareMultiplier,
  formatMultiplier,
  type ExactMultiplier,
} from '../../../shared/mechanics/type_effectiveness';
import { GenerationSelector } from '../../components/generation_selector';
import { humanizeTypeIdentifier } from '../../components/attacking_type_editor';
import { AbilitySupportIndicator } from '../../components/ability_support_indicator';
import { PokemonImage } from '../../components/pokemon_image';
import {
  activeTeamHeading,
  activeTeamStatus,
  type TeamIdentityBinding,
} from '../../components/saved_team_file_bar';
import { TypeBadge } from '../../components/type_badge';

export type AttackDirection = 'opponent' | 'user';

interface MatchupSlot {
  slotIndex: number;
  selection: TeamMemberSelection | null;
  option: TeamPokemonOption | null;
}

const neutral: ExactMultiplier = { numerator: 1, denominator: 1 };

function currentSelection(
  selection: TeamMemberSelection,
  option: TeamPokemonOption,
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
  opponentTeamSlots,
  userPersistence,
  opponentPersistence,
  direction,
  onDirectionChange,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
  userTeamSlots: TeamSlot[];
  opponentTeamSlots: TeamSlot[];
  userPersistence: TeamIdentityBinding;
  opponentPersistence: TeamIdentityBinding;
  direction: AttackDirection;
  onDirectionChange: (direction: AttackDirection) => void;
}) {
  const [options, setOptions] = useState<TeamPokemonOption[]>([]);
  const [chart, setChart] = useState<TypeChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void Promise.all([
      window.pokemonMatchupFoundry.listTeamPokemonOptions(generationId),
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
  const attackingLabel = direction === 'opponent' ? 'Opponent Team' : 'Your Team';
  const defendingLabel = direction === 'opponent' ? 'Your Team' : 'Opponent Team';

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

      <section className="matchup_identity_summary" aria-label="Active teams">
        <TeamIdentity side="user" binding={userPersistence} />
        <span aria-hidden="true">vs.</span>
        <TeamIdentity side="opponent" binding={opponentPersistence} />
      </section>

      <section className="matchup_direction_bar" aria-label="Attack direction">
        <div>
          <span>Active direction</span>
          <strong>{attackingLabel} Attacking</strong>
          <small>{defendingLabel} defending</small>
        </div>
        <button
          type="button"
          onClick={() => onDirectionChange(direction === 'opponent' ? 'user' : 'opponent')}
        >
          Switch to {direction === 'opponent' ? 'Your Team' : 'Opponent Team'} Attacking
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

function TeamIdentity({
  side,
  binding,
}: {
  side: 'user' | 'opponent';
  binding: TeamIdentityBinding;
}) {
  const status = activeTeamStatus(binding);
  return (
    <div>
      <strong>{activeTeamHeading(side, binding.savedTeam)}</strong>
      <small>{status ?? (binding.savedTeam ? 'Saved state current' : 'Not saved')}</small>
    </div>
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
  optionByFormId: Map<number, TeamPokemonOption>;
  attackingLabel: string;
  defendingLabel: string;
}) {
  const attackers: MatchupSlot[] = fixedAttackingSlots(attackingSlots).map(
    ({ selection, slotIndex }) => ({
      slotIndex,
      selection,
      option: selection ? optionByFormId.get(selection.formId) ?? null : null,
    }),
  );
  const defenders: MatchupSlot[] = fixedAttackingSlots(defendingSlots).map(
    ({ selection, slotIndex }) => ({
      slotIndex,
      selection,
      option: selection ? optionByFormId.get(selection.formId) ?? null : null,
    }),
  );

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
          {attackers.flatMap((attackerSlot) => {
            const selection = attackerSlot.selection;
            const attacker = selection && attackerSlot.option
              ? currentSelection(selection, attackerSlot.option)
              : null;
            const attackingTypes = selection
              ? normalizedAttackTypes(selection)
              : [null, null, null, null];
            return attackingTypes.map((identifier, entryIndex) => {
              const attackingType = identifier
                ? chart.types.find((type) => type.identifier === identifier)
                : undefined;
              return (
                <tr
                  key={`${attackerSlot.slotIndex}-${entryIndex}`}
                  className={`${entryIndex === 0 ? 'matchup_group_start' : ''} ${entryIndex === 3 ? 'matchup_group_end' : ''}`.trim()}
                >
                  {entryIndex === 0 && (
                    <th
                      className={`matchup_attacker_header ${selection ? '' : 'matchup_attacker_empty'}`.trim()}
                      scope="rowgroup"
                      rowSpan={4}
                    >
                      {selection ? (
                        <>
                          <PokemonImage
                            imagePath={attackerSlot.option?.imagePath ?? selection.imagePath}
                            name={attackerSlot.option?.name ?? selection.name}
                          />
                          <strong>{attackerSlot.option?.name ?? selection.name}</strong>
                          <small>Slot {attackerSlot.slotIndex + 1}</small>
                          <small className="ability_display">
                            {attackerSlot.option ? (attacker?.ability?.name ?? '—') : 'Unavailable'}
                            {attackerSlot.option && (
                              <AbilitySupportIndicator
                                abilityIdentifier={attacker?.ability?.identifier ?? null}
                                context="offensive"
                              />
                            )}
                          </small>
                        </>
                      ) : (
                        <>
                          <strong>Slot {attackerSlot.slotIndex + 1}</strong>
                          <small>Empty</small>
                        </>
                      )}
                    </th>
                  )}
                  <th className="matchup_attack_type" scope="row">
                    {attackingType ? (
                      <TypeBadge name={attackingType.name} identifier={attackingType.identifier} compact />
                    ) : identifier ? (
                      <span>{humanizeTypeIdentifier(identifier)}<small>Unavailable</small></span>
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
                    const kind = !selection || !identifier
                      ? 'empty'
                      : value
                        ? multiplierKind(value)
                        : defenderSlot.selection && attackerSlot.selection
                          ? 'unavailable'
                          : 'empty';
                    const text = value ? formatMultiplier(value) : '—';
                    const defenderName = defenderSlot.selection?.name ?? `Slot ${defenderSlot.slotIndex + 1}`;
                    const attackName = identifier
                      ? humanizeTypeIdentifier(identifier)
                      : `Move ${entryIndex + 1}`;
                    const description = !selection
                      ? 'empty attacking Pokémon slot'
                      : !identifier
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
                        title={`${attackName} from ${selection?.name ?? `Slot ${attackerSlot.slotIndex + 1}`} attacking ${defenderName}: ${description}`}
                        aria-label={`${attackName} from ${selection?.name ?? `Slot ${attackerSlot.slotIndex + 1}`} attacking ${defenderName}: ${description}`}
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
      <small className="ability_display">
        {slot.option ? (current.ability?.name ?? '—') : 'Unavailable'}
        {slot.option && (
          <AbilitySupportIndicator
            abilityIdentifier={current.ability?.identifier ?? null}
            context="defensive"
          />
        )}
      </small>
    </th>
  );
}
