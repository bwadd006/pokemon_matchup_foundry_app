import { describe, expect, it } from 'vitest';

import { abilitySupportMessage } from '../../src/renderer/components/ability_support_indicator';

describe('ability support explanations', () => {
  it('describes Fluffy precisely in defensive contexts', () => {
    expect(abilitySupportMessage('fluffy', 'defensive')).toContain('Fire vulnerability');
    expect(abilitySupportMessage('fluffy', 'defensive')).toContain('contact-based');
  });

  it('only reports limitations relevant to the analysis context', () => {
    expect(abilitySupportMessage('blaze', 'defensive')).toBeNull();
    expect(abilitySupportMessage('blaze', 'offensive')).toContain('attacking effect');
    expect(abilitySupportMessage('fur-coat', 'offensive')).toBeNull();
    expect(abilitySupportMessage('fur-coat', 'defensive')).toContain('defensive effect');
  });

  it('combines both applicable limitations in Team Builder', () => {
    const message = abilitySupportMessage('punk-rock', 'all');
    expect(message).toContain('defensive effect');
    expect(message).toContain('attacking effect');
  });

  it('does not flag fully modeled abilities', () => {
    expect(abilitySupportMessage('levitate', 'all')).toBeNull();
    expect(abilitySupportMessage('mold-breaker', 'offensive')).toBeNull();
  });
});
