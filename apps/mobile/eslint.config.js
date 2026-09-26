// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Workstream boundaries (root CLAUDE.md): import another module only through its
// public index.ts, e.g. '../detection' is fine, '../detection/mocks' is not.
const MODULES = '(detection|road|trip|api|voice)';
const noDeepImports = {
  regex: `(^|/)${MODULES}/.+`,
  message: 'Import other modules through their public index.ts only (root CLAUDE.md).',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noDeepImports] }],
    },
  },
  {
    // Logic modules never import from ui/ (root CLAUDE.md "UI rules").
    files: ['src/{detection,road,trip,api,voice,contracts}/**/*.{ts,tsx}', 'src/wiring.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noDeepImports,
            { regex: '(^|/)ui(/|$)', message: 'Logic modules must not import from ui/.' },
          ],
        },
      ],
    },
  },
]);
