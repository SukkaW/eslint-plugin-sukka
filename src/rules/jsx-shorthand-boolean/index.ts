import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

export type MessageId = 'omitBooleanValue';

export default createRule({
  name: 'jsx-shorthand-boolean',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce shorthand for boolean JSX attributes.'
    },
    fixable: 'code',
    messages: {
      omitBooleanValue: 'Omit the value for boolean attributes.'
    },
    schema: []
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const { value } = node;
        if (value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
        if (value.expression.type !== AST_NODE_TYPES.Literal || value.expression.value !== true) return;
        context.report({
          node,
          messageId: 'omitBooleanValue',
          fix: (fixer) => fixer.removeRange([node.name.range[1], value.range[1]])
        });
      }
    };
  }
});
