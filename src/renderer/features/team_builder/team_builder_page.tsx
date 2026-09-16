import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';

import type { Generation, PokemonType } from '../../../shared/models/pokedex';
import type {
  TeamMemberSelection,
  TeamPokemonOption,
  TeamSide,
  TeamSlot,
} from '../../../shared/models/team';
import { fixedAttackingSlots, reorderTeamSlots } from '../../../shared/team_slots';
import { AbilitySupportIndicator } from '../../components/ability_support_indicator';
import { AttackingTypeEditor } from '../../components/attacking_type_editor';
import { GenerationSelector } from '../../components/generation_selector';
import { PokemonImage } from '../../components/pokemon_image';
import { PokemonSelector } from '../../components/pokemon_selector';
import {
  activeTeamHeading,
  SavedTeamFileBar,
  type SavedTeamBinding,
} from '../../components/saved_team_file_bar';
import { TypeBadge } from '../../components/type_badge';

interface TeamEditorProps {
  side: TeamSide;
  slots: TeamSlot[];
  options: TeamPokemonOption[];
  optionByFormId: Map<number, TeamPokemonOption>;
  types: PokemonType[];
  generationId: number;
  onChange: (slots: TeamSlot[]) => void;
  persistence: SavedTeamBinding;
}

function selectionFromOption(option: TeamPokemonOption): TeamMemberSelection {
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

export function TeamBuilderPage({
  generations,
  generationId,
  onGenerationChange,
  userTeamSlots,
  onUserTeamChange,
  opponentTeamSlots,
  onOpponentTeamChange,
  userPersistence,
  opponentPersistence,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
  userTeamSlots: TeamSlot[];
  onUserTeamChange: (slots: TeamSlot[]) => void;
  opponentTeamSlots: TeamSlot[];
  onOpponentTeamChange: (slots: TeamSlot[]) => void;
  userPersistence: SavedTeamBinding;
  opponentPersistence: SavedTeamBinding;
}) {
  const [options, setOptions] = useState<TeamPokemonOption[]>([]);
  const [types, setTypes] = useState<PokemonType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void Promise.all([
      window.pokemonMatchupFoundry.listTeamPokemonOptions(generationId),
      window.pokemonMatchupFoundry.getTypeChart(generationId),
    ])
      .then(([nextOptions, chart]) => {
        setOptions(nextOptions);
        setTypes(chart.types);
      })
      .catch((reason: unknown) => {
        setOptions([]);
        setTypes([]);
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, [generationId]);

  const optionByFormId = useMemo(
    () => new Map(options.map((option) => [option.formId, option])),
    [options],
  );

  return (
    <main className="team_builder_page">
      <section className="hero team_builder_hero">
        <div>
          <p className="section_label">Team Builder</p>
          <h2>Build and manage both active teams</h2>
          <p>
            Edit Your Team and Opponent Team here. Type Coverage and Team
            Matchup use these shared teams as read-only analysis inputs.
          </p>
        </div>
        <GenerationSelector
          generations={generations}
          generationId={generationId}
          onChange={onGenerationChange}
        />
      </section>

      {error ? (
        <div className="error_state">
          <h3>Team Builder could not be loaded</h3>
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="loading_state">Loading Team Builder…</div>
      ) : (
        <>
          <TeamEditor
            side="user"
            slots={userTeamSlots}
            options={options}
            optionByFormId={optionByFormId}
            types={types}
            generationId={generationId}
            onChange={onUserTeamChange}
            persistence={userPersistence}
          />
          <TeamEditor
            side="opponent"
            slots={opponentTeamSlots}
            options={options}
            optionByFormId={optionByFormId}
            types={types}
            generationId={generationId}
            onChange={onOpponentTeamChange}
            persistence={opponentPersistence}
          />
        </>
      )}
    </main>
  );
}

function TeamEditor({
  side,
  slots,
  options,
  optionByFormId,
  types,
  generationId,
  onChange,
  persistence,
}: TeamEditorProps) {
  const role = side === 'user' ? 'Your Team' : 'Opponent Team';
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const dragHandleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusSlotIndex = useRef<number | null>(null);

  useEffect(() => {
    const slotIndex = pendingFocusSlotIndex.current;
    if (slotIndex === null) return;
    dragHandleRefs.current[slotIndex]?.focus();
    pendingFocusSlotIndex.current = null;
  }, [slots]);

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

  function completeReorder(fromSlotIndex: number, toSlotIndex: number): void {
    const member = slots[fromSlotIndex];
    if (!member || fromSlotIndex === toSlotIndex) return;

    pendingFocusSlotIndex.current = toSlotIndex;
    onChange(reorderTeamSlots(slots, fromSlotIndex, toSlotIndex));
    setReorderAnnouncement(
      `${member.name} moved to Slot ${toSlotIndex + 1} in ${role}.`,
    );
  }

  function startDragging(event: DragEvent<HTMLButtonElement>, slotIndex: number): void {
    setDraggedSlotIndex(slotIndex);
    setDropSlotIndex(slotIndex);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${side}:${slotIndex}`);
  }

  function dragOverSlot(event: DragEvent<HTMLElement>, slotIndex: number): void {
    if (draggedSlotIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropSlotIndex(slotIndex);
  }

  function dropOnSlot(event: DragEvent<HTMLElement>, slotIndex: number): void {
    if (draggedSlotIndex === null) return;
    event.preventDefault();
    completeReorder(draggedSlotIndex, slotIndex);
    finishDragging();
  }

  function finishDragging(): void {
    setDraggedSlotIndex(null);
    setDropSlotIndex(null);
  }

  return (
    <section className="team_builder_team_editor" aria-label={`${role} editor`}>
      <div className="team_builder_team_heading">
        <div>
          <p className="section_label">Team setup</p>
          <h3>{activeTeamHeading(side, persistence.savedTeam)}</h3>
        </div>
        <span>Up to four attacking types per Pokémon</span>
      </div>
      <SavedTeamFileBar
        side={side}
        generationId={generationId}
        slots={slots}
        {...persistence}
      />
      <p className="team_builder_reorder_help">
        Drag a populated Pokémon by its reorder handle, or use Move left and
        Move right, to change its position.
      </p>
      <div className="visually_hidden" role="status" aria-live="polite">
        {reorderAnnouncement}
      </div>
      <div className="team_slots team_builder_team_slots">
        {fixedAttackingSlots(slots).map(({ selection, slotIndex }) => {
          const option = selection ? optionByFormId.get(selection.formId) : undefined;
          const unavailable = Boolean(selection && !option);
          const abilityValid = Boolean(
            selection?.ability &&
            option?.abilities.some((ability) => ability.id === selection.ability?.id),
          );
          const ability = abilityValid ? selection?.ability ?? null : null;

          return (
            <article
              className={`team_slot team_builder_team_slot ${unavailable ? 'team_slot_unavailable' : ''} ${draggedSlotIndex === slotIndex ? 'team_builder_team_slot_dragging' : ''} ${draggedSlotIndex !== null && dropSlotIndex === slotIndex ? 'team_builder_team_slot_drop_target' : ''}`}
              key={slotIndex}
              onDragOver={(event) => dragOverSlot(event, slotIndex)}
              onDrop={(event) => dropOnSlot(event, slotIndex)}
            >
              <div className="team_slot_heading">
                <span>Slot {slotIndex + 1}</span>
                {selection && (
                  <span className="team_builder_slot_actions">
                    <button
                      type="button"
                      className="team_builder_move_button"
                      disabled={slotIndex === 0}
                      aria-label={`Move ${selection.name} left in ${role} from Slot ${slotIndex + 1}`}
                      title="Move left"
                      onClick={() => completeReorder(slotIndex, slotIndex - 1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="team_builder_drag_handle"
                      draggable
                      ref={(element) => {
                        dragHandleRefs.current[slotIndex] = element;
                      }}
                      aria-label={`Reorder ${selection.name} in ${role} from Slot ${slotIndex + 1}`}
                      title="Drag to reorder"
                      onDragStart={(event) => startDragging(event, slotIndex)}
                      onDragEnd={finishDragging}
                    >
                      Drag
                    </button>
                    <button
                      type="button"
                      className="team_builder_move_button"
                      disabled={slotIndex === 5}
                      aria-label={`Move ${selection.name} right in ${role} from Slot ${slotIndex + 1}`}
                      title="Move right"
                      onClick={() => completeReorder(slotIndex, slotIndex + 1)}
                    >
                      →
                    </button>
                    <button type="button" onClick={() => updateSlot(slotIndex, null)}>
                      Clear
                    </button>
                  </span>
                )}
              </div>
              {!selection ? (
                <PokemonSelector
                  options={options}
                  onSelect={(selected) => updateSlot(slotIndex, selectionFromOption(selected))}
                />
              ) : (
                <>
                  <div className="team_slot_identity team_builder_slot_identity">
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
                    <p className="slot_warning">
                      Unavailable in Generation {generationId}; excluded from calculations.
                    </p>
                  ) : (
                    <>
                      <label className="ability_selector">
                        <span>Ability</span>
                        <span className="ability_selector_control">
                          <select
                            value={ability?.identifier ?? ''}
                            onChange={(event) => chooseAbility(slotIndex, event.target.value)}
                          >
                            <option value="">—</option>
                            {option!.abilities.map((entry) => (
                              <option key={entry.id} value={entry.identifier}>
                                {entry.name}{entry.isHidden ? ' (Hidden)' : ''}
                              </option>
                            ))}
                          </select>
                          <AbilitySupportIndicator
                            abilityIdentifier={ability?.identifier ?? null}
                            context="all"
                          />
                        </span>
                      </label>
                      {selection.ability && !abilityValid && (
                        <p className="slot_warning">
                          That ability is unavailable in Generation {generationId}; no effect is applied.
                        </p>
                      )}
                      <AttackingTypeEditor
                        selection={selection}
                        types={types}
                        teamLabel={role.toLocaleLowerCase()}
                        onChange={(attackingTypeIdentifiers) =>
                          updateMember(slotIndex, { attackingTypeIdentifiers })
                        }
                      />
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
