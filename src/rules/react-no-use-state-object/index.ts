import { createRule } from '@/utils/create-eslint-rule';
import { isUseStateCall } from '@/utils/react-hooks';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

// there are some special edge cases:
//
// - useState({})[1]({}) is commonly used for force-update
// - useState({ inst })[1]({ inst }) can force-update while re-use the slot as a mutable ref
//
// However, more than one key is not common and should be avoided.
const DEFAULT_MAX_KEYS = 1;

export default createRule<{ maxKeys?: number } | undefined, [{ maxKeys?: number }?], 'default'>({
  name: 'react-no-use-state-object',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow useState with object literals that have too many keys. Split into multiple useState calls or use `foxact/use-state-with-deps` for re-render optimization and partial updates support.'
    },
    messages: {
      default: 'useState is initialized with an object literal containing {{count}} keys. You should split into multiple `useState` calls for granular updates; Or use `useStateWithDeps` from `foxact/use-state-with-deps` so that you can do partial updates and have re-render optimization.'
    },
    schema: [{
      type: 'object',
      properties: {
        maxKeys: {
          type: 'number',
          minimum: 1
        }
      },
      additionalProperties: false
    }]
  },
  create(context, options) {
    const maxKeys = options?.maxKeys ?? DEFAULT_MAX_KEYS;

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isUseStateCall(node)) return;
        if (node.arguments.length === 0) return;

        const arg = node.arguments[0];
        // useState(() => ({ ... })) — lazy initializer
        let init: TSESTree.Node = arg;
        if (arg.type === AST_NODE_TYPES.ArrowFunctionExpression && arg.body.type !== AST_NODE_TYPES.BlockStatement) {
          init = arg.body;
        }

        if (init.type !== AST_NODE_TYPES.ObjectExpression) return;
        if (init.properties.length > maxKeys) {
          context.report({
            node,
            messageId: 'default',
            data: { count: String(init.properties.length) }
          });
        }
      }
    };
  }
});
