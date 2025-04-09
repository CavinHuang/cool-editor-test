import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import cleanup from 'rollup-plugin-cleanup';
import { terser } from 'rollup-plugin-terser';
export default {
  input: './src/index.js',
  output: {
    dir: 'build',
    format: 'es',
    sourcemap: false
  },
  plugins: [
    resolve(),
    postcss({
      modules: true,
      extract: true
    }),
    babel({
      babelrc: false,
      plugins: [
        [
          '@babel/plugin-transform-react-jsx',
          {
            useBuiltIns: true
          }
        ],
        '@babel/plugin-proposal-optional-chaining'
      ]
    }),
    commonjs()
    // terser(),
    // cleanup(),
  ]
};
