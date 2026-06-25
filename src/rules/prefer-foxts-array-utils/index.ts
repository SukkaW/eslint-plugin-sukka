import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

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
    let hasAppendImport = false;

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'foxts/append-array-in-place') {
          hasAppendImport = true;
        }
      },
      CallExpression(node) {
        if (!isPushCall(node) || !hasSpreadArgument(node)) return;

        const receiver = context.sourceCode.getText((node.callee as TSESTree.MemberExpression).object);

        context.report({
          node,
          messageId: 'noSpreadInPush',
          *fix(fixer) {
            // Build import if needed
            if (!hasAppendImport) {
              const program = context.sourceCode.ast;
              const lastImport = program.body.findLast(
                (s) => s.type === AST_NODE_TYPES.ImportDeclaration
              );
              const importText = 'import { appendArrayInPlace } from \'foxts/append-array-in-place\';\n';
              if (lastImport) {
                yield fixer.insertTextAfter(lastImport, '\n' + importText);
              } else {
                yield fixer.insertTextBefore(program.body[0], importText);
              }
              hasAppendImport = true;
            }

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

            // Find the statement that contains this call
            let statement: TSESTree.Node = node;
            while (
              statement.parent.type !== AST_NODE_TYPES.Program
              && statement.parent.type !== AST_NODE_TYPES.BlockStatement
            ) {
              statement = statement.parent;
            }

            const indent = /^(\s*)/.exec(context.sourceCode.getText(statement))?.[1] ?? '';
            const replacement = segments.join('\n' + indent);

            yield fixer.replaceText(statement, replacement);
          }
        });
      }
    };
  }
});
