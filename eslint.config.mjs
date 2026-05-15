// @ts-check
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  // Carpetas y archivos generados / ignorados globalmente.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'pnpm-lock.yaml',
      'apps/web/next-env.d.ts',
    ],
  },

  // Base compartida.
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // apps/api — Nest. Reglas con type-checking y globals de Node + Jest.
  {
    files: ['apps/api/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: `${__dirname}/apps/api`,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },

  // apps/web — Next.js (core-web-vitals + typescript) via FlatCompat.
  ...compat.extends('next/core-web-vitals', 'next/typescript').map((cfg) => ({
    ...cfg,
    files: ['apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  })),
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    settings: {
      next: { rootDir: 'apps/web/' },
    },
  },

  // Prettier al final para desactivar reglas estilísticas conflictivas.
  eslintPluginPrettierRecommended,
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
