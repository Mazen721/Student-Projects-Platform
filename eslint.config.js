import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const UI_TEXT_PROPS = new Set(['placeholder', 'title', 'aria-label', 'alt']);
const PHYSICAL_RTL_CLASS_RE = /(?:^|\s)(?:[a-z]+:)*(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)|border-[lr](?:-|$)|rounded-[lr](?:-|$))/;
const PUNCTUATION_ONLY_RE = /^[\s\d/:.,·•×%()\-+|—–«»؟!،]*$/;

const sppPlugin = {
  rules: {
    'no-literal-ui-props': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow hardcoded string literals in user-facing JSX props' },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (!node.name || !UI_TEXT_PROPS.has(node.name.name) || !node.value) return;
            const literal =
              node.value.type === 'Literal'
                ? node.value.value
                : node.value.type === 'JSXExpressionContainer' && node.value.expression.type === 'Literal'
                  ? node.value.expression.value
                  : null;
            if (typeof literal === 'string' && !PUNCTUATION_ONLY_RE.test(literal)) {
              context.report({
                node: node.value,
                message: `Hardcoded string in "${node.name.name}" prop is forbidden; use @/locales/ar instead.`,
              });
            }
          },
        };
      },
    },
    'no-physical-rtl-classes': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow physical directional Tailwind classes in favor of logical RTL classes' },
        schema: [],
      },
      create(context) {
        function checkText(node, text) {
          if (typeof text === 'string' && PHYSICAL_RTL_CLASS_RE.test(text)) {
            context.report({
              node,
              message: 'Use RTL logical CSS utilities (ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start, border-s-*) instead of physical left/right classes.',
            });
          }
        }
        return {
          JSXAttribute(node) {
            if (!node.name || node.name.name !== 'className' || !node.value) return;
            if (node.value.type === 'Literal') {
              checkText(node.value, node.value.value);
            } else if (node.value.type === 'JSXExpressionContainer') {
              const expr = node.value.expression;
              if (expr.type === 'Literal') checkText(expr, expr.value);
              if (expr.type === 'TemplateLiteral') {
                expr.quasis.forEach((q) => checkText(q, q.value.raw));
              }
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server/**/*.js', 'e2e/**/*.js', 'playwright.config.js', 'client/vite.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['server/src/modules/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*/*.model.js', '../*/*.model', '**/modules/*/*.model.js'],
              message: 'Cross-module model imports are forbidden; import from the module index.js service interface instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      spp: sppPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            '/', ':', '-', '·', '•', '×', '%', '(', ')', ',', '.', '...', '|', '+', '—', '–', '«', '»', '؟', '!', '،',
          ],
        },
      ],
      'spp/no-literal-ui-props': 'error',
      'spp/no-physical-rtl-classes': 'error',
    },
  },
  {
    files: ['client/src/test/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    rules: {
      'react/jsx-no-literals': 'off',
      'spp/no-literal-ui-props': 'off',
    },
  },
];
