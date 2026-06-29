import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalReference, unwrapExpression } from '@/utils/ast';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

function getStorageKind(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Expression
): 'local' | 'session' | null {
  const expression = unwrapExpression(node);

  if (expression.type === AST_NODE_TYPES.Identifier && isGlobalReference(sourceCode, expression)) {
    if (expression.name === 'localStorage') return 'local';
    if (expression.name === 'sessionStorage') return 'session';
    return null;
  }

  if (
    expression.type !== AST_NODE_TYPES.MemberExpression
    || expression.computed
    || expression.property.type !== AST_NODE_TYPES.Identifier
  ) {
    return null;
  }

  const propertyName = expression.property.name;
  if (propertyName !== 'localStorage' && propertyName !== 'sessionStorage') return null;

  const object = unwrapExpression(expression.object);

  if (object.type === AST_NODE_TYPES.Identifier && isGlobalReference(sourceCode, object) && (object.name === 'window' || object.name === 'globalThis' || object.name === 'self')) {
    return propertyName === 'localStorage' ? 'local' : 'session';
  }

  return null;
}

export default createRule({
  name: 'react-prefer-foxact-persistent',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow localStorage and sessionStorage in React code.'
    },
    messages: {
      local: 'Do not use `localStorage` in React code. Use `foxact/use-local-storage` or `foxact/create-local-storage-state` instead.',
      session: 'Do not use `sessionStorage` in React code. Use `foxact/use-session-storage` or `foxact/create-session-storage-state` instead.',
      returnLocalStorage: 'Do not return `useLocalStorage()` directly. If you want to share the storage across multiple components, use `foxact/create-local-storage-state` instead.',
      returnSessionStorage: 'Do not return `useSessionStorage()` directly. If you want to share the storage across multiple components, use `foxact/create-session-storage-state` instead.'
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;

    function checkReturnedStorageHook(reportNode: TSESTree.Node, expression: TSESTree.Expression) {
      const arg = unwrapExpression(expression);
      if (arg.type !== AST_NODE_TYPES.CallExpression) return;

      const callee = arg.callee;
      if (callee.type === AST_NODE_TYPES.Identifier) {
        if (callee.name === 'useLocalStorage') {
          context.report({ node: reportNode, messageId: 'returnLocalStorage' });
        } else if (callee.name === 'useSessionStorage') {
          context.report({ node: reportNode, messageId: 'returnSessionStorage' });
        }
      }
    }

    return {
      MemberExpression(node) {
        const kind = getStorageKind(sourceCode, node);
        if (kind == null) return;

        if (
          node.parent.type === AST_NODE_TYPES.MemberExpression
          && node.parent.object === node
          && getStorageKind(sourceCode, node.parent) != null
        ) {
          return;
        }

        context.report({ node, messageId: kind });
      },
      ReturnStatement(node) {
        if (node.argument == null) return;
        checkReturnedStorageHook(node, node.argument);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type === AST_NODE_TYPES.BlockStatement) return;
        checkReturnedStorageHook(node, node.body);
      },
      Identifier(node) {
        if (node.name !== 'localStorage' && node.name !== 'sessionStorage') return;
        if (!isGlobalReference(sourceCode, node)) return;

        // Skip property access position (e.g. window.localStorage — handled by MemberExpression)
        if (
          node.parent.type === AST_NODE_TYPES.MemberExpression
          && node.parent.property === node
          && !node.parent.computed
        ) {
          return;
        }

        // Skip when parent MemberExpression is already a storage access (avoid double report with MemberExpression handler)
        if (
          node.parent.type === AST_NODE_TYPES.MemberExpression
          && node.parent.object === node
          && getStorageKind(sourceCode, node.parent) != null
        ) {
          return;
        }

        const kind = node.name === 'localStorage' ? 'local' as const : 'session' as const;
        context.report({ node, messageId: kind });
      }
    };
  }
});
