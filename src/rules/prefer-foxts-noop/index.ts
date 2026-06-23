import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

type MessageId = 'noop' | 'trueFn' | 'falseFn' | 'asyncNoop';

type SupportedFunction = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

function getFunctionBodyKind(node: SupportedFunction): MessageId | null {
  if (node.async) {
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return null;
    if (node.body.body.length === 0) return 'asyncNoop';
    if (
      node.body.body.length === 1
      && node.body.body[0].type === AST_NODE_TYPES.ReturnStatement
      && node.body.body[0].argument == null
    ) {
      return 'asyncNoop';
    }
    return null;
  }

  // Arrow with expression body: () => true, () => false, () => Promise.resolve()
  if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return getReturnedExpressionKind(node.body);
  }

  if (node.body.body.length === 0) return 'noop';
  if (node.body.body.length !== 1) return null;

  const [statement] = node.body.body;
  if (statement.type !== AST_NODE_TYPES.ReturnStatement) return null;

  // bare `return;` is a noop
  if (statement.argument == null) return 'noop';

  return getReturnedExpressionKind(statement.argument);
}

function getReturnedExpressionKind(node: TSESTree.Expression): MessageId | null {
  if (node.type === AST_NODE_TYPES.Literal) {
    if (node.value === true) return 'trueFn';
    if (node.value === false) return 'falseFn';
    return null;
  }

  if (
    node.type === AST_NODE_TYPES.CallExpression
    && node.callee.type === AST_NODE_TYPES.MemberExpression
    && !node.callee.computed
    && node.callee.object.type === AST_NODE_TYPES.Identifier
    && node.callee.object.name === 'Promise'
    && node.callee.property.type === AST_NODE_TYPES.Identifier
    && node.callee.property.name === 'resolve'
    && node.arguments.length === 0
  ) {
    return 'asyncNoop';
  }

  return null;
}

function getReportTarget(node: SupportedFunction): TSESTree.Node {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) return node;
  return node.parent ?? node;
}

export default createRule({
  name: 'prefer-foxts-noop',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer noop helpers from foxts/foxact over empty or trivially constant functions.'
    },
    messages: {
      noop: 'Do not use empty functions. Use `noop` from `foxts/noop` or `foxact/noop` instead.',
      trueFn: 'Do not use trivial functions that only return `true`. Use `trueFn` from `foxts/noop` instead.',
      falseFn: 'Do not use trivial functions that only return `false`. Use `falseFn` from `foxts/noop` instead.',
      asyncNoop: 'Do not use empty async or resolved-promise functions. Use `asyncNoop` from `foxts/noop` instead.'
    },
    schema: []
  },
  create(context) {
    return {
      ':function': (node: SupportedFunction) => {
        const messageId = getFunctionBodyKind(node);
        if (messageId == null) return;

        context.report({
          node: getReportTarget(node),
          messageId
        });
      }
    };
  }
});
