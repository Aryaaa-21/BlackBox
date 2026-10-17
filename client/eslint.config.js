import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/sw.js', 'e2e-artifacts/**', 'e2e-report/**', 'test-results/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', console: 'readonly', setTimeout: 'readonly', process: 'readonly', structuredClone: 'readonly', fetch: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['playwright.config.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', process: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-constant-binary-expression': 'off',
    },
  },
)
