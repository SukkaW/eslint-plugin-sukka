import { createRule } from '@/utils/create-eslint-rule';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

const RE_LEADING_WHITESPACE = /^(\s*)/;

function hasSpreadArgument(node: TSESTree.CallExpression): boolean {
  return node.arguments.some((arg) => arg.type === AST_NODE_TYPES.SpreadElement);
}

function isPushCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.MemberExpression
    && !node.callee.computed
    && node.callee.property.type === AST_NODE_TYPES.Identifier
    && node.callee.property.name === 'push';
}

export default createRule({
  name: 'prefer-foxts-array-utils',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow spread arguments in `Array.prototype.push()`. Use `appendArrayInPlace` from `foxts/append-array-in-place` instead.'
    },
    fixable: 'code',
    messages: {
      noSpreadInPush: 'Do not use spread arguments in `.push()`. Use `appendArrayInPlace` from `foxts/append-array-in-place` instead.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isPushCall(node) || !hasSpreadArgument(node)) return;

        const receiver = context.sourceCode.getText((node.callee as TSESTree.MemberExpression).object);

        context.report({
          node,
          messageId: 'noSpreadInPush',
          *fix(fixer) {
            yield *ensureNamedImport(fixer, context.sourceCode, 'foxts/append-array-in-place', 'appendArrayInPlace');

            // Group arguments into runs:
            // - consecutive non-spread args become one push() call
            // - each spread arg becomes an appendArrayInPlace() call
            const args = node.arguments;
            const segments: string[] = [];
            let nonSpreadBuf: string[] = [];

            const flushNonSpread = () => {
              if (nonSpreadBuf.length > 0) {
                segments.push(`${receiver}.push(${nonSpreadBuf.join(', ')});`);
                nonSpreadBuf = [];
              }
            };

            for (const arg of args) {
              if (arg.type === AST_NODE_TYPES.SpreadElement) {
                flushNonSpread();
                const spreadArgText = context.sourceCode.getText(arg.argument);
                segments.push(`appendArrayInPlace(${receiver}, ${spreadArgText});`);
              } else {
                nonSpreadBuf.push(context.sourceCode.getText(arg));
              }
            }
            flushNonSpread();

            // Find the ExpressionStatement that contains this call
            let statement: TSESTree.Node = node;
            while (statement.type !== AST_NODE_TYPES.ExpressionStatement && statement.parent != null) {
              statement = statement.parent;
            }

            const indent = RE_LEADING_WHITESPACE.exec(context.sourceCode.getText(statement))?.[1] ?? '';
            const replacement = segments.join('\n' + indent);

            yield fixer.replaceText(statement, replacement);
          }
        });
      }
    };
  }
});
