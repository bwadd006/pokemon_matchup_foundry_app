import type { TeamMemberSelection } from '../models/team';
import type { TypeChart } from '../models/type_effectiveness';
import { applyDefensiveAbility } from './ability_effects';
import { combineMultipliers, type ExactMultiplier } from './type_effectiveness';

export function calculateDefensiveCoverageMultiplier(
  chart: TypeChart,
  attackingTypeId: number,
  member: TeamMemberSelection,
): ExactMultiplier | undefined {
  const defendingTypeIds = member.types.map((type) => type.id);
  const typeMultipliers = defendingTypeIds.map((defendingTypeId) =>
    chart.matchups.find(
      (entry) =>
        entry.attackingTypeId === attackingTypeId &&
        entry.defendingTypeId === defendingTypeId,
    ),
  );
  if (typeMultipliers.some((entry) => !entry)) return undefined;

  const attackingType = chart.types.find((type) => type.id === attackingTypeId);
  if (!attackingType) return undefined;

  return applyDefensiveAbility({
    multiplier: combineMultipliers(
      typeMultipliers.map((entry) => ({
        numerator: entry!.numerator,
        denominator: entry!.denominator,
      })),
    ),
    attackingTypeIdentifier: attackingType.identifier,
    abilityIdentifier: member.ability?.identifier ?? null,
    generationId: chart.generationId,
  });
}
