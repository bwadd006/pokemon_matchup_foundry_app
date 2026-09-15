import { useId } from 'react';

import { abilitySupport } from '../../shared/mechanics/ability_effects';
import { attackingAbilitySupport } from '../../shared/mechanics/attacking_coverage';

export type AbilityAnalysisContext = 'defensive' | 'offensive' | 'all';

function defensiveLimitation(identifier: string): string | null {
  const support = abilitySupport(identifier);
  if (support === 'partially_supported') {
    return identifier === 'fluffy'
      ? 'Defensive Coverage models the Fire vulnerability, but not the contact-based damage reduction.'
      : 'Some defensive effects are modeled, but conditional effects are omitted.';
  }
  if (support === 'conditional_unmodeled') {
    return 'Its defensive effect depends on battle details that this app does not model.';
  }
  return null;
}

function offensiveLimitation(identifier: string): string | null {
  return attackingAbilitySupport(identifier) === 'conditional_unmodeled'
    ? 'Its attacking effect depends on battle details that this app does not model.'
    : null;
}

export function abilitySupportMessage(
  identifier: string,
  context: AbilityAnalysisContext,
): string | null {
  const defensive = context === 'offensive' ? null : defensiveLimitation(identifier);
  const offensive = context === 'defensive' ? null : offensiveLimitation(identifier);
  return [defensive, offensive].filter((message): message is string => Boolean(message)).join(' ') || null;
}

export function AbilitySupportIndicator({
  abilityIdentifier,
  context,
}: {
  abilityIdentifier: string | null;
  context: AbilityAnalysisContext;
}) {
  const tooltipId = useId();
  if (!abilityIdentifier) return null;
  const message = abilitySupportMessage(abilityIdentifier, context);
  if (!message) return null;

  return (
    <span className="ability_support_indicator">
      <button
        type="button"
        className="ability_support_trigger"
        aria-label={`Not fully implemented: ${message}`}
        aria-describedby={tooltipId}
      >
        ▲
      </button>
      <span className="ability_support_tooltip" id={tooltipId} role="tooltip">
        <strong>Not fully implemented</strong>
        <span>{message}</span>
      </span>
    </span>
  );
}
