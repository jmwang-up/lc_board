import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '.superpowers/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        AbortController: 'readonly', Blob: 'readonly', document: 'readonly', fetch: 'readonly', File: 'readonly',
        HTMLButtonElement: 'readonly', HTMLInputElement: 'readonly', process: 'readonly', requestAnimationFrame: 'readonly',
        Response: 'readonly', URL: 'readonly', window: 'readonly', crypto: 'readonly', console: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
