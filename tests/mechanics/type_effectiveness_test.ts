import { describe, expect, it } from 'vitest';

import { combineMultipliers } from '../../src/shared/mechanics/type_effectiveness';

describe('combineMultipliers', () => {
  it('combines two weaknesses into quadruple damage', () => {
    expect(
      combineMultipliers([
        { numerator: 2, denominator: 1 },
        { numerator: 2, denominator: 1 },
      ]),
    ).toEqual({ numerator: 4, denominator: 1 });
  });

  it('combines two resistances into quarter damage', () => {
    expect(
      combineMultipliers([
        { numerator: 1, denominator: 2 },
        { numerator: 1, denominator: 2 },
      ]),
    ).toEqual({ numerator: 1, denominator: 4 });
  });

  it('lets immunity override other multipliers', () => {
    expect(
      combineMultipliers([
        { numerator: 0, denominator: 1 },
        { numerator: 2, denominator: 1 },
      ]),
    ).toEqual({ numerator: 0, denominator: 1 });
  });
});
