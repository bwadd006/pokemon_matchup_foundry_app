export interface ExactMultiplier {
  numerator: number;
  denominator: number;
}

export function combineMultipliers(
  multipliers: ExactMultiplier[],
): ExactMultiplier {
  if (multipliers.some((entry) => entry.numerator === 0)) {
    return { numerator: 0, denominator: 1 };
  }

  const numerator = multipliers.reduce(
    (value, entry) => value * entry.numerator,
    1,
  );
  const denominator = multipliers.reduce(
    (value, entry) => value * entry.denominator,
    1,
  );
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}


export function multiplyMultipliers(
  left: ExactMultiplier,
  right: ExactMultiplier,
): ExactMultiplier {
  return combineMultipliers([left, right]);
}

export function compareMultiplier(
  left: ExactMultiplier,
  right: ExactMultiplier,
): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

export function formatMultiplier(multiplier: ExactMultiplier): string {
  if (multiplier.numerator === 0) return 'IMMUNE';
  if (multiplier.numerator === multiplier.denominator) return '';

  const knownFractions: Record<string, string> = {
    '1/8': '⅛×',
    '1/4': '¼×',
    '1/2': '½×',
    '2/3': '⅔×',
    '3/4': '¾×',
    '5/4': '1¼×',
    '13/10': '1.3×',
    '4/3': '1⅓×',
    '3/2': '1½×',
    '5/2': '2½×',
    '13/5': '2.6×',
    '8/3': '2⅔×',
  };
  const key = `${multiplier.numerator}/${multiplier.denominator}`;
  if (knownFractions[key]) return knownFractions[key];
  if (multiplier.denominator === 1) return `${multiplier.numerator}×`;
  return `${multiplier.numerator}/${multiplier.denominator}×`;
}
