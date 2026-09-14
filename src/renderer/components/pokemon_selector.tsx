import { useId, useMemo, useState } from 'react';

import type { TeamBuilderOption } from '../../shared/models/team';

export function PokemonSelector({
  options,
  onSelect,
}: {
  options: TeamBuilderOption[];
  onSelect: (option: TeamBuilderOption) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-results`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options.slice(0, 8);
    return options
      .filter((option) => {
        const dex = String(option.nationalDexNumber);
        return (
          option.name.toLocaleLowerCase().includes(normalized) ||
          option.identifier.includes(normalized) ||
          dex.includes(normalized.replace(/^#/, ''))
        );
      })
      .slice(0, 8);
  }, [options, query]);

  function choose(option: TeamBuilderOption): void {
    onSelect(option);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="pokemon_selector">
      <label htmlFor={inputId}>Choose Pokémon or form</label>
      <input
        id={inputId}
        type="search"
        value={query}
        placeholder="Search name or Pokédex number"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].formId}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && open && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul id={listId} className="pokemon_results" role="listbox">
          {results.length ? results.map((option, index) => (
            <li
              id={`${listId}-${option.formId}`}
              key={option.formId}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>#{String(option.nationalDexNumber).padStart(4, '0')}</span>
                <strong>{option.name}</strong>
                <small>{option.types.map((type) => type.name).join(' / ')}</small>
              </button>
            </li>
          )) : (
            <li className="pokemon_results_empty">No matching Pokémon</li>
          )}
        </ul>
      )}
    </div>
  );
}
