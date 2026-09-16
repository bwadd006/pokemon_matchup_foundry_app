import type { TypeChartMatchup } from '../../shared/models/type_effectiveness';

type EffectivenessKind =
  | 'immune'
  | 'resisted'
  | 'neutral'
  | 'super_effective'
  | 'unavailable';

function presentation(matchup: TypeChartMatchup | undefined): {
  kind: EffectivenessKind;
  text: string;
  description: string;
} {
  if (!matchup) {
    return { kind: 'unavailable', text: '—', description: 'data unavailable' };
  }
  if (matchup.numerator === 0) {
    return { kind: 'immune', text: 'IMMUNE', description: 'immune' };
  }
  if (matchup.numerator === 1 && matchup.denominator === 2) {
    return { kind: 'resisted', text: '½×', description: 'half damage' };
  }
  if (matchup.numerator === 1 && matchup.denominator === 1) {
    return { kind: 'neutral', text: '', description: 'normal damage' };
  }
  if (matchup.numerator === 2 && matchup.denominator === 1) {
    return { kind: 'super_effective', text: '2×', description: 'double damage' };
  }
  return { kind: 'unavailable', text: '—', description: 'data unavailable' };
}

export function EffectivenessCell({
  matchup,
  attackingType,
  defendingType,
  rowHovered,
  columnHovered,
  rowLocked,
  columnLocked,
  locked,
  onHover,
  onLeave,
  onToggle,
}: {
  matchup: TypeChartMatchup | undefined;
  attackingType: string;
  defendingType: string;
  rowHovered: boolean;
  columnHovered: boolean;
  rowLocked: boolean;
  columnLocked: boolean;
  locked: boolean;
  onHover: () => void;
  onLeave: () => void;
  onToggle: () => void;
}) {
  const value = presentation(matchup);
  const label = `${attackingType} attacking ${defendingType}: ${value.description}`;
  const classes = [
    'effectiveness_cell',
    `effectiveness_${value.kind}`,
    rowHovered ? 'chart_row_hovered' : '',
    columnHovered ? 'chart_column_hovered' : '',
    rowLocked ? 'chart_row_locked' : '',
    columnLocked ? 'chart_column_locked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td className={classes}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={locked}
        title={label}
        onClick={onToggle}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onFocus={onHover}
        onBlur={onLeave}
      >
        {value.text}
      </button>
    </td>
  );
}
