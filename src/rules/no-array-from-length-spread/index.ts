import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

function isArrayFromWithLengthArg(node: TSESTree.CallExpression) {
  const { callee } = node;

  if (
    callee.type !== AST_NODE_TYPES.MemberExpression
    || callee.object.type !== AST_NODE_TYPES.Identifier
    || callee.object.name !== 'Array'
    || callee.property.type !== AST_NODE_TYPES.Identifier
    || callee.property.name !== 'from'
  ) {
    return false;
  }

  if (node.arguments.length < 1) return false;

  const firstArg = node.arguments[0];
  if (firstArg.type === AST_NODE_TYPES.ObjectExpression) {
    return firstArg.properties.some(
      (prop) => prop.type === AST_NODE_TYPES.Property
        && prop.key.type === AST_NODE_TYPES.Identifier
        && prop.key.name === 'length'
    );
  }

  return false;
}

function isNewArrayExpression(node: TSESTree.NewExpression | TSESTree.CallExpression) {
  return node.callee.type === AST_NODE_TYPES.Identifier
    && node.callee.name === 'Array'
    && node.arguments.length === 1;
}

function isSpreadOfNewArray(element: TSESTree.SpreadElement) {
  const arg = element.argument;
  if (arg.type === AST_NODE_TYPES.NewExpression) {
    return isNewArrayExpression(arg);
  }
  if (arg.type === AST_NODE_TYPES.CallExpression) {
    return isNewArrayExpression(arg);
  }
  return false;
}

export default createRule({
  name: 'no-array-from-length-spread',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow creating arrays from length using `Array.from({ length })` or `[...Array(n)]`. Use `foxts/create-fixed-array` or `foxact/create-fixed-array` instead.'
    },
    messages: {
      noArrayFromLength: 'Do not use `Array.from({ length })` to create arrays. Use `createFixedArray` from `foxts/create-fixed-array` or `foxact/create-fixed-array` instead.',
      noSpreadNewArray: 'Do not use `[...Array(n)]` or `[...new Array(n)]` to create arrays. Use `createFixedArray` from `foxts/create-fixed-array` or `foxact/create-fixed-array` instead.'
    },
    schema: []
  },
  create: (context) => ({
    CallExpression(node) {
      if (isArrayFromWithLengthArg(node)) {
        context.report({
          node,
          messageId: 'noArrayFromLength'
        });
      }
    },
    ArrayExpression(node) {
      for (const element of node.elements) {
        if (
          element?.type === AST_NODE_TYPES.SpreadElement
          && isSpreadOfNewArray(element)
        ) {
          context.report({
            node,
            messageId: 'noSpreadNewArray'
          });
        }
      }
    }
  })
});
