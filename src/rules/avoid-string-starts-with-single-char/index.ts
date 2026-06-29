import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

function isSingleCharStringLiteral(node: TSESTree.Node): node is TSESTree.Literal & { value: string } {
  return node.type === AST_NODE_TYPES.Literal
    && typeof node.value === 'string'
    && node.value.length === 1;
}

export default createRule({
  name: 'avoid-string-starts-with-single-char',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `str[0] === "x"` over `str.startsWith("x")` when checking a single character.'
    },
    fixable: 'code',
    messages: {
      default: 'Use `{{replacement}}` instead of `{{original}}`. Indexing is faster than `startsWith` for a single character.'
    },
    schema: []
  },
  create(context) {
    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="startsWith"]': (node: TSESTree.CallExpression) => {
        if (node.arguments.length !== 1) return;
        const arg = node.arguments[0];
        if (!isSingleCharStringLiteral(arg)) return;

        const callee = node.callee as TSESTree.MemberExpression;
        const objectText = context.sourceCode.getText(callee.object);
        const charText = context.sourceCode.getText(arg);

        const needsParens = callee.object.type === AST_NODE_TYPES.AwaitExpression
          || callee.object.type === AST_NODE_TYPES.BinaryExpression
          || callee.object.type === AST_NODE_TYPES.LogicalExpression
          || callee.object.type === AST_NODE_TYPES.AssignmentExpression
          || callee.object.type === AST_NODE_TYPES.SequenceExpression
          || callee.object.type === AST_NODE_TYPES.ConditionalExpression;

        const indexedAccess = needsParens ? `(${objectText})[0]` : `${objectText}[0]`;
        const replacement = `${indexedAccess} === ${charText}`;

        const negated = node.parent.type === AST_NODE_TYPES.UnaryExpression
          && node.parent.operator === '!';

        if (negated) {
          const negatedReplacement = `${indexedAccess} !== ${charText}`;
          context.report({
            node: node.parent,
            messageId: 'default',
            data: {
              replacement: negatedReplacement,
              original: context.sourceCode.getText(node.parent)
            },
            fix: (fixer) => fixer.replaceText(node.parent, negatedReplacement)
          });
          return;
        }

        context.report({
          node,
          messageId: 'default',
          data: {
            replacement,
            original: context.sourceCode.getText(node)
          },
          fix: (fixer) => fixer.replaceText(node, replacement)
        });
      }
    };
  }
});
