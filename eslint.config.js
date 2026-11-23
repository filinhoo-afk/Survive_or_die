// Линтер ловит ошибки, а не спорит о стиле: опечатки в именах, мёртвый код,
// недостижимые ветки. Форматирование не проверяется — игра пишется без сборки
// и без форматтера.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', '_site/'] },

  js.configs.recommended,

  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      // Аргумент, начатый с «_», намеренно не используется.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // Игра: браузер, ES-модули.
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },

  // Тесты, проверка доступа к базе и сам конфиг: Node.
  {
    files: ['tests/**/*.js', 'supabase/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
