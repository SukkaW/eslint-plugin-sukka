import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';
import { createRule } from '@/utils/create-eslint-rule';

type Allow = 'always' | 'as-needed';

type RawOption =
  | Allow
  | { allow?: Allow, extensions?: readonly string[], ignoreFilesWithoutCode?: boolean }
  | null
  | undefined;

interface Options {
  allow: Allow,
  extensions: readonly string[],
  ignoreFilesWithoutCode: boolean
}

const optionSchema: JSONSchema4 = {
  anyOf: [
    {
      type: 'string',
      enum: ['always', 'as-needed']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        allow: {
          type: 'string',
          enum: ['always', 'as-needed']
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true
        },
        ignoreFilesWithoutCode: {
          type: 'boolean'
        }
      }
    }
  ]
};

export default createRule({
  name: 'react-filename-extension',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce consistent use of the JSX file extension.'
    },
    messages: {
      missingJsxExtension: 'File \'{{name}}\' should use a JSX extension (e.g. {{extensions}}) when it contains JSX.',
      unnecessaryJsxExtension: 'File \'{{name}}\' should not use a JSX extension when it does not contain JSX.'
    },
    schema: [optionSchema]
  },
  resolveOptions(raw?: RawOption): Options {
    if (raw == null) {
      return { allow: 'as-needed', extensions: ['.jsx', '.tsx'], ignoreFilesWithoutCode: false };
    }
    if (typeof raw === 'string') {
      return { allow: raw, extensions: ['.jsx', '.tsx'], ignoreFilesWithoutCode: false };
    }
    return {
      allow: raw.allow ?? 'as-needed',
      extensions: raw.extensions ?? ['.jsx', '.tsx'],
      ignoreFilesWithoutCode: raw.ignoreFilesWithoutCode ?? false
    };
  },
  create(context, options) {
    let hasJSXNode = false;

    return {
      JSXElement() {
        hasJSXNode = true;
      },
      JSXFragment() {
        hasJSXNode = true;
      },
      'Program:exit': function (program) {
        if (options.ignoreFilesWithoutCode && program.body.length === 0) return;

        const { filename } = context;
        const lastDot = filename.lastIndexOf('.');
        const fileExt = lastDot < 0 ? '' : filename.slice(lastDot);
        const isJSXExt = options.extensions.includes(fileExt);

        if (hasJSXNode && !isJSXExt) {
          context.report({
            messageId: 'missingJsxExtension',
            node: program,
            data: { name: filename, extensions: options.extensions.join(', ') }
          });
          return;
        }

        if (!hasJSXNode && isJSXExt && options.allow === 'as-needed') {
          context.report({
            messageId: 'unnecessaryJsxExtension',
            node: program,
            data: { name: filename }
          });
        }
      }
    };
  }
});
