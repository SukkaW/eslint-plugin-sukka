import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalMemberAccess, unwrapExpression } from '@/utils/ast';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

export default createRule({
  name: 'no-object-create-non-null',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow `Object.create` with a non-null prototype. Only `Object.create(null)` (prototype-less object) is a common legitimate use; anything else usually indicates a mistake.'
    },
    messages: {
      default: '`Object.create` with a non-null prototype is rare and usually indicates a mistake. Use a class, an object literal, or `Object.create(null)` for a prototype-less object.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
        if (!isGlobalMemberAccess(context.sourceCode, node.callee, 'Object', 'create')) return;

        // Object.create() with no argument throws at runtime anyway — still a mistake
        if (node.arguments.length === 0) {
          context.report({ node, messageId: 'default' });
          return;
        }

        const arg = node.arguments[0];
        if (arg.type === AST_NODE_TYPES.SpreadElement) {
          context.report({ node, messageId: 'default' });
          return;
        }

        const proto = unwrapExpression(arg);
        if (proto.type === AST_NODE_TYPES.Literal && proto.value === null) return;

        context.report({ node, messageId: 'default' });
      }
    };
  }
});
