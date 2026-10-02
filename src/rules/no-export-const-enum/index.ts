import { createRule } from '@/utils/create-eslint-rule';
import { collectEnumExports } from '@/utils/enum';

export default createRule({
  name: 'no-export-const-enum',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow using `export const enum` expression as cross-module `const enum` can not be inlined and tree-shaken by swc/esbuild/babel/webpack/rollup/vite/bun/rspack'
    },
    messages: {
      noConstEnum: 'Do not use `export const enum` expression as cross-module `const enum` can not be inlined and tree-shaken by swc/esbuild/babel/webpack/rollup/vite/bun/rspack'
    },
    schema: []
  },

  create(context) {
    let hasConstEnum = false;
    return {
      TSEnumDeclaration(node) {
        hasConstEnum ||= node.const;
      },
      'Program:exit': function (program) {
        if (!hasConstEnum) return;
        for (const [declaration, node] of collectEnumExports(context.sourceCode, program)) {
          if (declaration.const) {
            context.report({ node, messageId: 'noConstEnum' });
          }
        }
      }
    };
  }
});
