import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';

export default createRule({
  name: 'no-regex-in-function',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce hoisting literal regex to module level to avoid re-creation on every call.'
    },
    messages: {
      default: 'Enforce hoisting literal regex to module level to avoid re-creation on every call.'
    },
    schema: []
  },
  create(context) {
    return {
      Literal(node: TSESTree.Literal) {
        if (!('regex' in node) || !node.regex) return;

        let current: TSESTree.Node | undefined = node.parent;
        while (current != null) {
          if (ASTUtils.isFunction(current) || ASTUtils.isLoop(current)) {
            context.report({ node, messageId: 'default' });
            return;
          }
          // Non-static class property initializer runs per instantiation
          if (
            current.type === AST_NODE_TYPES.PropertyDefinition
            && !current.static
          ) {
            context.report({ node, messageId: 'default' });
            return;
          }
          current = current.parent;
        }
      }
    };
  }
});
