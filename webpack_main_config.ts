import type { Configuration } from 'webpack';

import { plugins } from './webpack_plugins';
import { rules } from './webpack_rules';

export const mainConfig: Configuration = {
  entry: './src/main/main.ts',
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
