import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        monaco: 'readonly',
        lucide: 'readonly',
        JsonEditor: 'readonly',
        App: 'readonly',
        JsonUtils: 'readonly',
        CsvUtils: 'readonly',
        DiffUtils: 'readonly',
        QueryUtils: 'readonly',
        Modal: 'readonly',
        TreeView: 'readonly',
        TextEditor: 'readonly',
        TableView: 'readonly',
        EditorToolbar: 'readonly',
        JSONRepair: 'readonly',
        Theme: 'readonly',
        jsonrepair: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
    'no-console': 'off',
      'no-debugger': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
