export function TypeBadge({
  name,
  identifier,
  compact = false,
}: {
  name: string;
  identifier: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`type_badge type_${identifier} ${compact ? 'type_badge_compact' : ''}`}
    >
      {name}
    </span>
  );
}
