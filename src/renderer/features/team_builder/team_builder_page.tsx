import { useEffect, useMemo, useState } from 'react';

import type { Generation } from '../../../shared/models/pokedex';
import type {
  TeamBuilderOption,
  TeamMemberSelection,
  TeamSlot,
} from '../../../shared/models/team';
import type { TypeChart } from '../../../shared/models/type_effectiveness';
import { abilitySupport } from '../../../shared/mechanics/ability_effects';
import { calculateDefensiveMultiplier } from '../../../shared/mechanics/team_builder';
import {
  compareMultiplier,
  formatMultiplier,
  type ExactMultiplier,
} from '../../../shared/mechanics/type_effectiveness';
import { GenerationSelector } from '../../components/generation_selector';
import { PokemonImage } from '../../components/pokemon_image';
import { PokemonSelector } from '../../components/pokemon_selector';
import { TypeBadge } from '../../components/type_badge';

interface CoverageSlot {
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

function multiplierKind(multiplier: ExactMultiplier | undefined): string {
  if (!multiplier) return 'unavailable';
  if (multiplier.numerator === 0) return 'immune';
  const comparison = compareMultiplier(multiplier, neutral);
  if (comparison < 0) return 'resisted';
  if (comparison > 0) return 'super_effective';
  return 'neutral';
}

export function TeamBuilderPage({
  generations,
  generationId,
  onGenerationChange,
  teamSlots,
  onTeamSlotsChange,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
  teamSlots: TeamSlot[];
  onTeamSlotsChange: (slots: TeamSlot[]) => void;
}) {
  const [options, setOptions] = useState<TeamBuilderOption[]>([]);
  const [chart, setChart] = useState<TypeChart | null>(null);
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
  const coverageSlots: CoverageSlot[] = teamSlots.map((selection, slotIndex) => ({
    slotIndex,
    selection,
    option: selection ? optionByFormId.get(selection.formId) ?? null : null,
  }));
  const teamIsEmpty = teamSlots.every((selection) => selection === null);

  function updateSlot(slotIndex: number, selection: TeamSlot): void {
    const next = [...teamSlots];
    next[slotIndex] = selection;
    onTeamSlotsChange(next);
  }

  function chooseAbility(slotIndex: number, abilityIdentifier: string): void {
    const current = teamSlots[slotIndex];
    if (!current) return;
    const option = optionByFormId.get(current.formId);
    const ability = option?.abilities.find(
      (entry) => entry.identifier === abilityIdentifier,
    ) ?? null;
    updateSlot(slotIndex, {
      ...current,
      ...(option ? {
        name: option.name,
        imagePath: option.imagePath,
        types: option.types,
      } : {}),
      ability,
    });
  }

  return (
    <main className="team_builder_page">
      <section className="hero team_builder_hero">
        <div>
          <p className="section_label">Defensive team coverage</p>
          <h2>Build a team and find its defensive gaps</h2>
          <p>
            Choose up to six Pokémon. Each row shows how one attacking type
            affects every selected team member after typing and supported abilities.
          </p>
        </div>
        <GenerationSelector
          generations={generations}
          generationId={generationId}
          onChange={onGenerationChange}
        />
      </section>

      <section className="team_slots" aria-label="Team slots">
        {teamSlots.map((selection, slotIndex) => {
          const option = selection ? optionByFormId.get(selection.formId) : undefined;
          const unavailable = Boolean(selection && !option);
          const selectedAbilityValid = Boolean(
            selection?.ability &&
            option?.abilities.some((ability) => ability.id === selection.ability?.id),
          );
          const selectedAbility = selectedAbilityValid ? selection?.ability : null;
          const support = selectedAbility
            ? abilitySupport(selectedAbility.identifier)
            : 'not_applicable';

          return (
            <article
              className={`team_slot ${unavailable ? 'team_slot_unavailable' : ''}`}
              key={slotIndex}
            >
              <div className="team_slot_heading">
                <span>Slot {slotIndex + 1}</span>
                {selection && (
                  <button type="button" onClick={() => updateSlot(slotIndex, null)}>
                    Clear
                  </button>
                )}
              </div>
              {selection ? (
                <>
                  <div className="team_slot_identity">
                    <PokemonImage
                      imagePath={option?.imagePath ?? selection.imagePath}
                      name={option?.name ?? selection.name}
                    />
                    <div>
                      <strong>{option?.name ?? selection.name}</strong>
                      <small>#{String(selection.nationalDexNumber).padStart(4, '0')}</small>
                      <div className="team_slot_types">
                        {(option?.types ?? selection.types).map((type) => (
                          <TypeBadge
                            key={type.identifier}
                            name={type.name}
                            identifier={type.identifier}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {unavailable ? (
                    <p className="slot_warning">Unavailable in Generation {generationId}; excluded from calculations.</p>
                  ) : (
                    <label className="ability_selector">
                      <span>Ability</span>
                      <select
                        value={selectedAbility?.identifier ?? ''}
                        onChange={(event) => chooseAbility(slotIndex, event.target.value)}
                      >
                        <option value="">—</option>
                        {option!.abilities.map((ability) => (
                          <option key={ability.id} value={ability.identifier}>
                            {ability.name}{ability.isHidden ? ' (Hidden)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!unavailable && selection.ability && !selectedAbilityValid && (
                    <p className="slot_warning">That ability is unavailable in Generation {generationId}; no ability effect is applied.</p>
                  )}
                  {support === 'partially_supported' && (
                    <p className="slot_notice">Type-based effects are applied; conditional effects are not modeled.</p>
                  )}
                  {support === 'conditional_unmodeled' && (
                    <p className="slot_notice">This ability depends on battle details, so its defensive effect is not modeled.</p>
                  )}
                </>
              ) : (
                <PokemonSelector
                  options={options}
                  onSelect={(option) => updateSlot(slotIndex, selectionFromOption(option))}
                />
              )}
            </article>
          );
        })}
      </section>

      <section className="type_chart_legend team_builder_legend" aria-label="Team coverage legend">
        <span className="legend_title">Damage</span>
        <span className="legend_item effectiveness_immune">IMMUNE</span>
        <span className="legend_item effectiveness_resisted">¼× / ½×</span>
        <span className="legend_item effectiveness_neutral">Blank = 1×</span>
        <span className="legend_item effectiveness_super_effective">2× / 4×</span>
        <span className="legend_guidance">Totals count team members, including immunity as resistance.</span>
      </section>

      <section className="team_coverage_panel" aria-busy={loading}>
        {error ? (
          <div className="error_state">
            <h3>The Team Builder could not be loaded</h3>
            <p>{error}</p>
          </div>
        ) : loading || !chart ? (
          <div className="loading_state">Loading Team Builder…</div>
        ) : (
          <>
            {teamIsEmpty && (
              <p className="team_empty_guidance">
                Choose a Pokémon in any slot. Each slot keeps the same coverage column.
              </p>
            )}
            <CoverageTable chart={chart} slots={coverageSlots} />
          </>
        )}
      </section>
    </main>
  );
}

function CoverageTable({ chart, slots }: { chart: TypeChart; slots: CoverageSlot[] }) {
  return (
    <div className="team_coverage_scroller">
      <table className="team_coverage_table">
        <caption className="visually_hidden">
          Generation {chart.generationId} defensive coverage for six fixed team slots
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
                    <small>Empty</small>
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
                  <small>{option ? (current.ability?.name ?? '—') : 'Unavailable'}</small>
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
              return calculateDefensiveMultiplier(chart, attackingType.id, current);
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
