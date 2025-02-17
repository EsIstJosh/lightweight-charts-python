// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import monaco from 'rollup-plugin-monaco-editor';
import typescript from '@rollup/plugin-typescript';
//const { terser } = require('@rollup/plugin-terser');
import json from '@rollup/plugin-json';

import replace from '@rollup/plugin-replace';
import { URL } from 'url';
export default {
  // Using your provided index.ts as the single entry point.
  input: 'src/index.ts',
    output: {
      file: 'dist/bundle.js',
      format: 'iife',
      name: 'Lib',
      sourcemap: true,
      globals: {
        'lightweight-charts': 'LightweightCharts',
        'monaco-editor': 'monaco', // Use the global variable "monaco" in the browser.
        'url': 'URL'
      }
    },
  external: ['lightweight-charts', 'monaco-editor','URL'],
  plugins: [
    postcss(),
    monaco({
      languages: ['typescript', 'javascript'],
      features: ['bracketMatching', 'hover', 'suggestions'],
    }),
    typescript({ tsconfig: './tsconfig.json' }),
    nodeResolve(),
    commonjs(),
    json(),
    replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        preventAssignment: true,
      }),
  ],
};
