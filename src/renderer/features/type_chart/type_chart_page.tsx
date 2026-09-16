import { useEffect, useMemo, useState } from 'react';

import type { Generation } from '../../../shared/models/pokedex';
import type {
  TypeChart,
  TypeChartMatchup,
} from '../../../shared/models/type_effectiveness';
import { EffectivenessCell } from '../../components/effectiveness_cell';
import { GenerationSelector } from '../../components/generation_selector';
import { TypeBadge } from '../../components/type_badge';

type Highlight =
  | { kind: 'row'; attackingTypeId: number }
  | { kind: 'column'; defendingTypeId: number }
  | { kind: 'cell'; attackingTypeId: number; defendingTypeId: number };

function sameHighlight(left: Highlight | null, right: Highlight): boolean {
  if (!left || left.kind !== right.kind) return false;
  if (left.kind === 'row' && right.kind === 'row') {
    return left.attackingTypeId === right.attackingTypeId;
  }
  if (left.kind === 'column' && right.kind === 'column') {
    return left.defendingTypeId === right.defendingTypeId;
  }
  return (
    left.kind === 'cell' &&
    right.kind === 'cell' &&
    left.attackingTypeId === right.attackingTypeId &&
    left.defendingTypeId === right.defendingTypeId
  );
}

function matchupKey(attackingTypeId: number, defendingTypeId: number): string {
  return `${attackingTypeId}:${defendingTypeId}`;
}

export function TypeChartPage({
  generations,
  generationId,
  onGenerationChange,
}: {
  generations: Generation[];
  generationId: number;
  onGenerationChange: (generationId: number) => void;
}) {
  const [chart, setChart] = useState<TypeChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Highlight | null>(null);
  const [locked, setLocked] = useState<Highlight | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHovered(null);
    setLocked(null);

    void window.pokemonMatchupFoundry
      .getTypeChart(generationId)
      .then(setChart)
      .catch((reason: unknown) => {
        setChart(null);
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, [generationId]);

  useEffect(() => {
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHovered(null);
        setLocked(null);
      }
    };
    window.addEventListener('keydown', clearOnEscape);
    return () => window.removeEventListener('keydown', clearOnEscape);
  }, []);

  const matchups = useMemo(() => {
    const values = new Map<string, TypeChartMatchup>();
    chart?.matchups.forEach((matchup) => {
      values.set(
        matchupKey(matchup.attackingTypeId, matchup.defendingTypeId),
        matchup,
      );
    });
    return values;
  }, [chart]);

  function toggleLocked(next: Highlight): void {
    setLocked((current) => (sameHighlight(current, next) ? null : next));
  }

  function rowIsHighlighted(highlight: Highlight | null, typeId: number): boolean {
    return Boolean(
      highlight &&
        (highlight.kind === 'row' || highlight.kind === 'cell') &&
        highlight.attackingTypeId === typeId,
    );
  }

  function columnIsHighlighted(highlight: Highlight | null, typeId: number): boolean {
    return Boolean(
      highlight &&
        (highlight.kind === 'column' || highlight.kind === 'cell') &&
        highlight.defendingTypeId === typeId,
    );
  }

  return (
    <main>
      <section className="hero type_chart_hero">
        <div>
          <p className="section_label">Type effectiveness</p>
          <h2>Attack and defense by generation</h2>
          <p>
            Attacking move types run down the left. Defending Pokémon types run
            across the top.
          </p>
        </div>
        <GenerationSelector
          generations={generations}
          generationId={generationId}
          onChange={onGenerationChange}
        />
      </section>

      <section className="type_chart_legend" aria-label="Type chart legend">
        <span className="legend_title">Damage</span>
        <span className="legend_item effectiveness_immune">IMMUNE</span>
        <span className="legend_item effectiveness_resisted">½×</span>
        <span className="legend_item effectiveness_neutral">Blank = 1×</span>
        <span className="legend_item effectiveness_super_effective">2×</span>
        <span className="legend_guidance">
          Hover to inspect. Click to lock. Click again or press Escape to clear.
        </span>
      </section>

      <section className="type_chart_panel" aria-busy={loading}>
        {error ? (
          <div className="error_state">
            <h3>The type chart could not be loaded</h3>
            <p>{error}</p>
          </div>
        ) : loading || !chart ? (
          <div className="loading_state">Loading type chart…</div>
        ) : (
          <div className="type_chart_scroller">
            <table className="type_chart_table">
              <caption className="visually_hidden">
                Generation {generationId} single-type effectiveness chart
              </caption>
              <thead>
                <tr>
                  <th className="type_chart_corner" scope="col">
                    <span>Defending →</span>
                    <span>Attacking ↓</span>
                  </th>
                  {chart.types.map((defendingType) => {
                    const selection: Highlight = {
                      kind: 'column',
                      defendingTypeId: defendingType.id,
                    };
                    const hoveredColumn = columnIsHighlighted(hovered, defendingType.id);
                    const lockedColumn = columnIsHighlighted(locked, defendingType.id);
                    return (
                      <th
                        key={defendingType.id}
                        scope="col"
                        className={[
                          hoveredColumn ? 'chart_column_hovered' : '',
                          lockedColumn ? 'chart_column_locked' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <button
                          type="button"
                          aria-label={`Highlight defending ${defendingType.name} column`}
                          aria-pressed={sameHighlight(locked, selection)}
                          onClick={() => toggleLocked(selection)}
                          onMouseEnter={() => setHovered(selection)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(selection)}
                          onBlur={() => setHovered(null)}
                        >
                          <TypeBadge
                            name={defendingType.name}
                            identifier={defendingType.identifier}
                            compact
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {chart.types.map((attackingType) => {
                  const rowSelection: Highlight = {
                    kind: 'row',
                    attackingTypeId: attackingType.id,
                  };
                  const hoveredRow = rowIsHighlighted(hovered, attackingType.id);
                  const lockedRow = rowIsHighlighted(locked, attackingType.id);
                  return (
                    <tr key={attackingType.id}>
                      <th
                        scope="row"
                        className={[
                          'type_chart_row_header',
                          hoveredRow ? 'chart_row_hovered' : '',
                          lockedRow ? 'chart_row_locked' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <button
                          type="button"
                          aria-label={`Highlight attacking ${attackingType.name} row`}
                          aria-pressed={sameHighlight(locked, rowSelection)}
                          onClick={() => toggleLocked(rowSelection)}
                          onMouseEnter={() => setHovered(rowSelection)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(rowSelection)}
                          onBlur={() => setHovered(null)}
                        >
                          <TypeBadge
                            name={attackingType.name}
                            identifier={attackingType.identifier}
                            compact
                          />
                        </button>
                      </th>
                      {chart.types.map((defendingType) => {
                        const selection: Highlight = {
                          kind: 'cell',
                          attackingTypeId: attackingType.id,
                          defendingTypeId: defendingType.id,
                        };
                        const hoveredColumn = columnIsHighlighted(hovered, defendingType.id);
                        const lockedColumn = columnIsHighlighted(locked, defendingType.id);
                        return (
                          <EffectivenessCell
                            key={defendingType.id}
                            matchup={matchups.get(
                              matchupKey(attackingType.id, defendingType.id),
                            )}
                            attackingType={attackingType.name}
                            defendingType={defendingType.name}
                            rowHovered={hoveredRow}
                            columnHovered={hoveredColumn}
                            rowLocked={lockedRow}
                            columnLocked={lockedColumn}
                            locked={sameHighlight(locked, selection)}
                            onHover={() => setHovered(selection)}
                            onLeave={() => setHovered(null)}
                            onToggle={() => toggleLocked(selection)}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
