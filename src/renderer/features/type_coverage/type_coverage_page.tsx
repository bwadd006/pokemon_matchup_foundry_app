import { useEffect, useMemo, useState } from 'react';

import type { Generation } from '../../../shared/models/pokedex';
import type {
  TeamPokemonOption,
  TeamMemberSelection,
  TeamSide,
  TeamSlot,
} from '../../../shared/models/team';
import type { TypeChart } from '../../../shared/models/type_effectiveness';
import { fixedAttackingSlots, normalizedAttackTypes } from '../../../shared/team_slots';
import { calculateDefensiveCoverageMultiplier } from '../../../shared/mechanics/defensive_coverage';
import { calculateOffensiveCoverageMultiplier } from '../../../shared/mechanics/attacking_coverage';
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

interface CoverageSlot {
  slotIndex: number;
  selection: TeamMemberSelection | null;
  option: TeamPokemonOption | null;
}

export type CoverageMode = 'defensive' | 'offensive';

const neutral: ExactMultiplier = { numerator: 1, denominator: 1 };

function multiplierKind(multiplier: ExactMultiplier | undefined): string {
  if (!multiplier) return 'unavailable';
  if (multiplier.numerator === 0) return 'immune';
  const comparison = compareMultiplier(multiplier, neutral);
  if (comparison < 0) return 'resisted';
  if (comparison > 0) return 'super_effective';
  return 'neutral';
}

export function TypeCoveragePage({
  generations,
  generationId,
  onGenerationChange,
  userTeamSlots,
  opponentTeamSlots,
  selectedSide,
  onSelectedSideChange,
  mode,
  onModeChange,
  persistence,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
  userTeamSlots: TeamSlot[];
  opponentTeamSlots: TeamSlot[];
  selectedSide: TeamSide;
  onSelectedSideChange: (side: TeamSide) => void;
  mode: CoverageMode;
  onModeChange: (mode: CoverageMode) => void;
  persistence: TeamIdentityBinding;
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
  const teamSlots = selectedSide === 'user' ? userTeamSlots : opponentTeamSlots;
  const activeTeamLabel = selectedSide === 'user' ? 'Your Team' : 'Opponent Team';
  const nextTeamLabel = selectedSide === 'user' ? 'Opponent Team' : 'Your Team';
  const activeModeLabel = mode === 'defensive' ? 'Defensive Coverage' : 'Offensive Coverage';
  const nextModeLabel = mode === 'defensive' ? 'Offensive Coverage' : 'Defensive Coverage';
  const coverageSlots: CoverageSlot[] = fixedAttackingSlots(teamSlots).map(
    ({ selection, slotIndex }) => ({
      slotIndex,
      selection,
      option: selection ? optionByFormId.get(selection.formId) ?? null : null,
    }),
  );

  return (
    <main className="type_coverage_page">
      <section className="hero type_coverage_hero">
        <div>
          <p className="section_label">Type Coverage</p>
          <h2>Analyze your team's type coverage</h2>
          <p>
            Compare incoming threats in Defensive Coverage or inspect how each
            Pokémon's selected attacking types cover individual defending types.
          </p>
        </div>
        <GenerationSelector
          generations={generations}
          generationId={generationId}
          onChange={onGenerationChange}
        />
      </section>

      <section className="matchup_direction_bar" aria-label="Coverage mode">
        <div>
          <span>Active mode</span>
          <strong>{activeModeLabel}</strong>
          <small>{mode === 'defensive' ? 'incoming attacks' : 'attacking-type coverage'}</small>
        </div>
        <button
          type="button"
          onClick={() => onModeChange(mode === 'defensive' ? 'offensive' : 'defensive')}
        >
          Switch to {nextModeLabel}
        </button>
      </section>

      <section className="matchup_direction_bar type_coverage_team_bar" aria-label="Coverage team">
        <div>
          <span>Active team</span>
          <strong>{activeTeamHeading(selectedSide, persistence.savedTeam)}</strong>
          <small>
            {activeModeLabel.toLocaleLowerCase()}
            {activeTeamStatus(persistence) ? ` · ${activeTeamStatus(persistence)}` : ''}
          </small>
        </div>
        <button
          type="button"
          onClick={() => onSelectedSideChange(selectedSide === 'user' ? 'opponent' : 'user')}
        >
          Switch to {nextTeamLabel}
        </button>
      </section>

      <section className="type_chart_legend type_coverage_legend" aria-label="Type coverage legend">
        <span className="legend_title">Damage</span>
        <span className="legend_item effectiveness_immune">IMMUNE</span>
        <span className="legend_item effectiveness_resisted">Below 1×</span>
        <span className="legend_item effectiveness_neutral">Blank = 1×</span>
        <span className="legend_item effectiveness_super_effective">Above 1×</span>
        {mode === 'defensive' && (
          <span className="legend_guidance">Totals count team members, including immunity as resistance.</span>
        )}
      </section>

      <section
        className={`team_coverage_panel ${mode === 'offensive' ? 'wide_data_panel' : ''}`}
        aria-busy={loading}
      >
        {error ? (
          <div className="error_state">
            <h3>Type Coverage could not be loaded</h3>
            <p>{error}</p>
          </div>
        ) : loading || !chart ? (
          <div className="loading_state">Loading Type Coverage…</div>
        ) : (
          mode === 'defensive' ? (
            <DefensiveCoverageTable
              chart={chart}
              slots={coverageSlots}
              teamLabel={activeTeamLabel}
            />
          ) : (
            <OffensiveCoverageTable
              chart={chart}
              slots={coverageSlots}
              teamLabel={activeTeamLabel}
            />
          )
        )}
      </section>
    </main>
  );
}

function DefensiveCoverageTable({
  chart,
  slots,
  teamLabel,
}: {
  chart: TypeChart;
  slots: CoverageSlot[];
  teamLabel: string;
}) {
  return (
    <div className="team_coverage_scroller">
      <table className="team_coverage_table">
        <caption className="visually_hidden">
          Generation {chart.generationId} defensive coverage for {teamLabel}'s six fixed slots
        </caption>
        <thead>
          <tr>
            <th className="team_coverage_corner" scope="col">
              <span>Team →</span>
              <span>Attacking ↓</span>
            </th>
            {slots.map(({ slotIndex, selection, option }) => {
              if (!selection) {
                return (
                  <th key={slotIndex} scope="col" className="team_member_header team_member_header_empty">
                    <strong>Slot {slotIndex + 1}</strong>
                    <small aria-label="Empty">—</small>
                  </th>
                );
              }
              const current = option
                ? { ...selection, name: option.name, imagePath: option.imagePath, types: option.types }
                : selection;
              return (
                <th key={slotIndex} scope="col" className="team_member_header">
                  <PokemonImage imagePath={current.imagePath} name={current.name} />
                  <strong>{current.name}</strong>
                  <div className="team_header_types">
                    {current.types.map((type) => (
                      <TypeBadge key={type.identifier} name={type.name} identifier={type.identifier} compact />
                    ))}
                  </div>
                  <small className="ability_display">
                    {option ? (current.ability?.name ?? '—') : 'Unavailable'}
                    {option && (
                      <AbilitySupportIndicator
                        abilityIdentifier={current.ability?.identifier ?? null}
                        context="defensive"
                      />
                    )}
                  </small>
                </th>
              );
            })}
            <th scope="col" className="coverage_total_header coverage_total_weak">Total Weak</th>
            <th scope="col" className="coverage_total_header coverage_total_resist">Total Resist</th>
          </tr>
        </thead>
        <tbody>
          {chart.types.map((attackingType) => {
            const values = slots.map(({ selection, option }) => {
              if (!selection || !option) return undefined;
              const abilityValid = selection.ability
                ? option.abilities.some((ability) => ability.id === selection.ability?.id)
                : true;
              const current: TeamMemberSelection = {
                ...selection,
                name: option.name,
                imagePath: option.imagePath,
                types: option.types,
                ability: abilityValid ? selection.ability : null,
              };
              return calculateDefensiveCoverageMultiplier(chart, attackingType.id, current);
            });
            const weak = values.filter(
              (value) => value && compareMultiplier(value, neutral) > 0,
            ).length;
            const resist = values.filter(
              (value) => value && compareMultiplier(value, neutral) < 0,
            ).length;

            return (
              <tr key={attackingType.id}>
                <th scope="row" className="team_type_header">
                  <TypeBadge name={attackingType.name} identifier={attackingType.identifier} compact />
                </th>
                {values.map((value, index) => {
                  const slot = slots[index]!;
                  const kind = value
                    ? multiplierKind(value)
                    : slot.selection
                      ? 'unavailable'
                      : 'empty';
                  const text = value ? formatMultiplier(value) : '—';
                  const defenderName = slot.selection?.name ?? `Slot ${slot.slotIndex + 1}`;
                  const description = !slot.selection
                    ? 'empty slot'
                    : !value
                      ? 'unavailable'
                      : value.numerator === 0
                        ? 'immune'
                        : `${value.numerator / value.denominator} times damage`;
                  return (
                    <td
                      key={slot.slotIndex}
                      className={`team_effectiveness_cell effectiveness_${kind}`}
                      title={`${attackingType.name} attacking ${defenderName}: ${description}`}
                      aria-label={`${attackingType.name} attacking ${defenderName}: ${description}`}
                    >
                      {text}
                    </td>
                  );
                })}
                <td className="coverage_total coverage_total_weak">{weak}</td>
                <td className="coverage_total coverage_total_resist">{resist}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OffensiveCoverageTable({
  chart,
  slots,
  teamLabel,
}: {
  chart: TypeChart;
  slots: CoverageSlot[];
  teamLabel: string;
}) {
  return (
    <div className="team_coverage_scroller">
      <table className="offensive_coverage_table">
        <colgroup>
          <col className="offensive_attacker_column" />
          <col className="offensive_attack_type_column" />
          {chart.types.map((type) => (
            <col key={type.id} className="offensive_defending_type_column" />
          ))}
        </colgroup>
        <caption className="visually_hidden">
          Generation {chart.generationId} offensive coverage for {teamLabel}'s six fixed slots
        </caption>
        <thead>
          <tr>
            <th className="offensive_coverage_corner" scope="colgroup" colSpan={2}>
              <span>Defending type →</span>
              <span>{teamLabel} attacks ↓</span>
            </th>
            {chart.types.map((defendingType) => (
              <th key={defendingType.id} scope="col" className="offensive_defending_type">
                <TypeBadge
                  name={defendingType.name}
                  identifier={defendingType.identifier}
                  compact
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.flatMap((slot) => {
            const selection = slot.selection;
            const abilityValid = Boolean(
              selection?.ability &&
              slot.option?.abilities.some((ability) => ability.id === selection.ability?.id),
            );
            const attacker = selection && slot.option
              ? {
                  ...selection,
                  name: slot.option.name,
                  imagePath: slot.option.imagePath,
                  types: slot.option.types,
                  ability: abilityValid ? selection.ability : null,
                }
              : null;
            const attackingTypes = selection
              ? normalizedAttackTypes(selection)
              : [null, null, null, null];

            return attackingTypes.map((identifier, entryIndex) => {
              const attackingType = identifier
                ? chart.types.find((type) => type.identifier === identifier)
                : undefined;
              const attackerName = selection?.name ?? `Slot ${slot.slotIndex + 1}`;

              return (
                <tr
                  key={`${slot.slotIndex}-${entryIndex}`}
                  className={`${entryIndex === 0 ? 'offensive_group_start' : ''} ${entryIndex === 3 ? 'offensive_group_end' : ''}`.trim()}
                >
                  {entryIndex === 0 && (
                    <th
                      className={`offensive_attacker_header ${selection ? '' : 'offensive_attacker_empty'}`.trim()}
                      scope="rowgroup"
                      rowSpan={4}
                    >
                      {selection ? (
                        <>
                          <PokemonImage
                            imagePath={slot.option?.imagePath ?? selection.imagePath}
                            name={slot.option?.name ?? selection.name}
                          />
                          <strong>{slot.option?.name ?? selection.name}</strong>
                          <small>Slot {slot.slotIndex + 1}</small>
                          <small className="ability_display">
                            {slot.option ? (attacker?.ability?.name ?? '—') : 'Unavailable'}
                            {slot.option && (
                              <AbilitySupportIndicator
                                abilityIdentifier={attacker?.ability?.identifier ?? null}
                                context="offensive"
                              />
                            )}
                          </small>
                        </>
                      ) : (
                        <>
                          <strong>Slot {slot.slotIndex + 1}</strong>
                          <small>Empty</small>
                        </>
                      )}
                    </th>
                  )}
                  <th className="offensive_attack_type" scope="row">
                    {attackingType ? (
                      <TypeBadge
                        name={attackingType.name}
                        identifier={attackingType.identifier}
                        compact
                      />
                    ) : identifier ? (
                      <span>
                        {humanizeTypeIdentifier(identifier)}
                        <small>Unavailable</small>
                      </span>
                    ) : (
                      <span className="empty_move_label">—</span>
                    )}
                  </th>
                  {chart.types.map((defendingType) => {
                    const value = attacker && attackingType
                      ? calculateOffensiveCoverageMultiplier(
                          chart,
                          attackingType.id,
                          attacker,
                          defendingType,
                        )
                      : undefined;
                    const kind = !selection || !identifier
                      ? 'empty'
                      : value
                        ? multiplierKind(value)
                        : 'unavailable';
                    const text = value ? formatMultiplier(value) : '—';
                    const attackName = identifier
                      ? humanizeTypeIdentifier(identifier)
                      : `Move ${entryIndex + 1}`;
                    const description = !selection
                      ? 'empty attacking Pokémon slot'
                      : !identifier
                        ? 'empty attacking type slot'
                        : !value
                          ? 'unavailable'
                          : value.numerator === 0
                            ? 'immune'
                            : `${value.numerator / value.denominator} times damage`;

                    return (
                      <td
                        key={defendingType.id}
                        className={`offensive_effectiveness_cell effectiveness_${kind}`}
                        title={`${attackName} from ${attackerName} attacking ${defendingType.name}: ${description}`}
                        aria-label={`${attackName} from ${attackerName} attacking ${defendingType.name}: ${description}`}
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
