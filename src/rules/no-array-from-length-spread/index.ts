import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

const SUGGESTION = 'Use `createFixedArray` from `foxts/create-fixed-array` or `foxact/create-fixed-array` instead.';

function isArrayConstructorWithLength(node: TSESTree.Node): node is TSESTree.CallExpression | TSESTree.NewExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression) {
    return false;
  }
  return node.callee.type === AST_NODE_TYPES.Identifier
    && node.callee.name === 'Array'
    && node.arguments.length === 1;
}

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

  return isArrayConstructorWithLength(firstArg);
}

const ARRAY_CHAINED_METHODS = new Set(['fill', 'map', 'flatMap', 'forEach', 'reduce', 'filter', 'find', 'findIndex', 'some', 'every', 'keys', 'values', 'entries']);

function isChainedMethodOnArrayConstructor(node: TSESTree.CallExpression) {
  const { callee } = node;

  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;

  if (
    callee.property.type !== AST_NODE_TYPES.Identifier
    || !ARRAY_CHAINED_METHODS.has(callee.property.name)
  ) {
    return false;
  }

  const object = callee.object;
  return isArrayConstructorWithLength(object);
}

export default createRule({
  name: 'no-array-from-length-spread',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow creating arrays from length using `Array.from({ length })`, `[...Array(n)]`, `Array(n).fill()`, etc. Use `foxts/create-fixed-array` or `foxact/create-fixed-array` instead.'
    },
    messages: {
      noArrayFromLength: `Do not use \`Array.from({ length })\` to create arrays. ${SUGGESTION}`,
      noSpreadNewArray: `Do not use \`[...Array(n)]\` or \`[...new Array(n)]\` to create arrays. ${SUGGESTION}`,
      noArrayConstructorChain: `Do not use \`Array(n).{{method}}()\` or \`new Array(n).{{method}}()\` to create arrays. ${SUGGESTION}`,
      noSpreadArrayIterator: `Do not use \`[...Array(n).{{method}}()]\` or \`[...new Array(n).{{method}}()]\` to create arrays. ${SUGGESTION}`
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
        return;
      }

      if (isChainedMethodOnArrayConstructor(node)) {
        const ancestors = context.sourceCode.getAncestors(node);
        const parent = ancestors[ancestors.length - 1];
        const grandparent = ancestors[ancestors.length - 2];
        if (
          parent.type === AST_NODE_TYPES.SpreadElement
          && grandparent.type === AST_NODE_TYPES.ArrayExpression
        ) {
          return;
        }

        const methodName = ((node.callee as TSESTree.MemberExpression).property as TSESTree.Identifier).name;
        context.report({
          node,
          messageId: 'noArrayConstructorChain',
          data: { method: methodName }
        });
      }
    },
    ArrayExpression(node) {
      for (const element of node.elements) {
        if (element?.type !== AST_NODE_TYPES.SpreadElement) continue;

        const arg = element.argument;

        if (
          (arg.type === AST_NODE_TYPES.CallExpression || arg.type === AST_NODE_TYPES.NewExpression)
          && arg.callee.type === AST_NODE_TYPES.MemberExpression
          && arg.callee.property.type === AST_NODE_TYPES.Identifier
          && isArrayConstructorWithLength(arg.callee.object)
        ) {
          context.report({
            node,
            messageId: 'noSpreadArrayIterator',
            data: { method: arg.callee.property.name }
          });
          continue;
        }

        if (isArrayConstructorWithLength(arg)) {
          context.report({
            node,
            messageId: 'noSpreadNewArray'
          });
        }
      }
    }
  })
});
