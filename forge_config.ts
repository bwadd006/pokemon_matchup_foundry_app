import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack_main_config';
import { rendererConfig } from './webpack_renderer_config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'pokemon_matchup_foundry',
    executableName: 'pokemon_matchup_foundry',
    extraResource: [
      './database/generated/pokemon.sqlite',
      './resources/images',
      './resources/image_manifest.json',
      './third_party_licenses',
      './third_party_notices.md',
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'pokemon_matchup_foundry',
    }),
    new MakerZIP({}, ['linux']),
    new MakerDeb({
      options: {
        maintainer: 'Pokémon Matchup Foundry contributors',
        homepage: 'https://github.com/bwadd006/pokemon_matchup_foundry_app',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' data:; img-src 'self' data: pmf-asset:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:",
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload/preload.ts',
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
