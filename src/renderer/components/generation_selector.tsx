import type { Generation } from '../../shared/models/pokedex';

export function GenerationSelector({
  generations,
  generationId,
  onChange,
}: {
  generations: Generation[];
  generationId: number;
  onChange: (generationId: number) => void;
}) {
  return (
    <label className="generation_control">
      <span>Generation</span>
      <select
        value={generationId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {generations.map((generation) => (
          <option key={generation.id} value={generation.id}>
            {generation.name}
          </option>
        ))}
      </select>
    </label>
  );
}
