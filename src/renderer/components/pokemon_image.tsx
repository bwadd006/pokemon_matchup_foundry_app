import { useEffect, useState } from 'react';

const placeholder = 'pmf-asset://local/placeholders/pokemon.svg';

export function PokemonImage({
  imagePath,
  name,
}: {
  imagePath: string | null;
  name: string;
}) {
  const desiredSource = imagePath
    ? `pmf-asset://local/${imagePath.split('/').map(encodeURIComponent).join('/')}`
    : placeholder;
  const [source, setSource] = useState(desiredSource);

  useEffect(() => setSource(desiredSource), [desiredSource]);

  return (
    <img
      src={source}
      alt={`${name} artwork`}
      loading="lazy"
      onError={() => setSource(placeholder)}
    />
  );
}
