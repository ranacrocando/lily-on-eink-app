import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist', '**/node_modules', '**/test-results', '**/playwright-report', 'public/licenses'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  { files: ['**/*.{js,mjs}'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['scripts/**', '**/*.mjs', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: globals.node },
  },
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  prettier,
);
