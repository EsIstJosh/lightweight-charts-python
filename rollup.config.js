// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import monaco from 'rollup-plugin-monaco-editor';
import typescript from '@rollup/plugin-typescript';
//const { terser } = require('@rollup/plugin-terser');
import { PineTS } from './lightweight_charts_/js/pinets.dev.es.js';
import json from '@rollup/plugin-json';
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
        'PineTS': 'PineTS'
      }
    },
  external: ['lightweight-charts', 'monaco-editor', 'PineTS'],
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
  ],
};
