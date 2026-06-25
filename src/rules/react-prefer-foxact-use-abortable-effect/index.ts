import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { isUseEffectCall, getEffectCallback } from '@/utils/react-hooks';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

function getReturnedFunction(callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
  const body = callback.body;

  if (body.type !== AST_NODE_TYPES.BlockStatement) return null;

  for (let i = body.body.length - 1; i >= 0; i--) {
    const stmt = body.body[i];
    if (stmt.type === AST_NODE_TYPES.ReturnStatement && stmt.argument != null && (
      stmt.argument.type === AST_NODE_TYPES.ArrowFunctionExpression
      || stmt.argument.type === AST_NODE_TYPES.FunctionExpression
    )) {
      return stmt.argument;
    }
  }
  return null;
}

function findCancelVarDeclarations(body: TSESTree.BlockStatement): string[] {
  const vars: string[] = [];
  for (const stmt of body.body) {
    if (stmt.type !== AST_NODE_TYPES.VariableDeclaration) continue;
    if (stmt.kind !== 'let' && stmt.kind !== 'var') continue;
    for (const decl of stmt.declarations) {
      if (
        decl.id.type === AST_NODE_TYPES.Identifier
        && decl.init?.type === AST_NODE_TYPES.Literal
        && decl.init.value === false
      ) {
        vars.push(decl.id.name);
      }
    }
  }
  return vars;
}

function cleanupAssignsTrue(cleanup: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression, varName: string): boolean {
  let body: TSESTree.Statement[];
  if (cleanup.body.type === AST_NODE_TYPES.BlockStatement) {
    body = cleanup.body.body;
  } else {
    // Arrow with expression body: () => cancel = true
    return (
      cleanup.body.type === AST_NODE_TYPES.AssignmentExpression
      && cleanup.body.operator === '='
      && cleanup.body.left.type === AST_NODE_TYPES.Identifier
      && cleanup.body.left.name === varName
      && cleanup.body.right.type === AST_NODE_TYPES.Literal
      && cleanup.body.right.value === true
    );
  }

  for (const stmt of body) {
    if (
      stmt.type === AST_NODE_TYPES.ExpressionStatement
      && stmt.expression.type === AST_NODE_TYPES.AssignmentExpression
      && stmt.expression.operator === '='
      && stmt.expression.left.type === AST_NODE_TYPES.Identifier
      && stmt.expression.left.name === varName
      && stmt.expression.right.type === AST_NODE_TYPES.Literal
      && stmt.expression.right.value === true
    ) {
      return true;
    }
  }
  return false;
}

function referencesVar(node: TSESTree.Node, varName: string): boolean {
  let current = node;
  while (current.type === AST_NODE_TYPES.UnaryExpression) {
    current = current.argument;
  }
  return current.type === AST_NODE_TYPES.Identifier && current.name === varName;
}

function pushChildren(node: TSESTree.Node, stack: TSESTree.Node[]): void {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
    case AST_NODE_TYPES.Program:
      appendArrayInPlace(stack, node.body);
      break;
    case AST_NODE_TYPES.ExpressionStatement:
      stack.push(node.expression);
      break;
    case AST_NODE_TYPES.ReturnStatement:
      if (node.argument) stack.push(node.argument);
      break;
    case AST_NODE_TYPES.IfStatement:
      stack.push(node.test, node.consequent);
      if (node.alternate) stack.push(node.alternate);
      break;
    case AST_NODE_TYPES.ConditionalExpression:
      stack.push(node.test, node.consequent, node.alternate);
      break;
    case AST_NODE_TYPES.LogicalExpression:
    case AST_NODE_TYPES.BinaryExpression:
    case AST_NODE_TYPES.AssignmentExpression:
      stack.push(node.left, node.right);
      break;
    case AST_NODE_TYPES.UnaryExpression:
    case AST_NODE_TYPES.AwaitExpression:
    case AST_NODE_TYPES.SpreadElement:
      stack.push(node.argument);
      break;
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression:
      stack.push(node.callee);
      appendArrayInPlace(stack, node.arguments);
      break;
    case AST_NODE_TYPES.MemberExpression:
      stack.push(node.object);
      if (node.computed) stack.push(node.property);
      break;
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression:
      stack.push(node.body);
      break;
    case AST_NODE_TYPES.VariableDeclaration:
      appendArrayInPlace(stack, node.declarations);
      break;
    case AST_NODE_TYPES.VariableDeclarator:
      if (node.init) stack.push(node.init);
      break;
    case AST_NODE_TYPES.ArrayExpression:
      for (const el of node.elements) {
        if (el) stack.push(el);
      }
      break;
    case AST_NODE_TYPES.ObjectExpression:
      appendArrayInPlace(stack, node.properties);
      break;
    case AST_NODE_TYPES.Property:
      stack.push(node.value);
      break;
    case AST_NODE_TYPES.TemplateLiteral:
    case AST_NODE_TYPES.SequenceExpression:
      appendArrayInPlace(stack, node.expressions);
      break;
    case AST_NODE_TYPES.ForStatement:
      if (node.init) stack.push(node.init);
      if (node.test) stack.push(node.test);
      if (node.update) stack.push(node.update);
      stack.push(node.body);
      break;
    case AST_NODE_TYPES.ForInStatement:
    case AST_NODE_TYPES.ForOfStatement:
      stack.push(node.right, node.body);
      break;
    case AST_NODE_TYPES.WhileStatement:
    case AST_NODE_TYPES.DoWhileStatement:
      stack.push(node.test, node.body);
      break;
    case AST_NODE_TYPES.SwitchStatement:
      stack.push(node.discriminant);
      appendArrayInPlace(stack, node.cases);
      break;
    case AST_NODE_TYPES.SwitchCase:
      if (node.test) stack.push(node.test);
      appendArrayInPlace(stack, node.consequent);
      break;
    case AST_NODE_TYPES.TryStatement:
      stack.push(node.block);
      if (node.handler) stack.push(node.handler.body);
      if (node.finalizer) stack.push(node.finalizer);
      break;
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSInstantiationExpression:
      stack.push(node.expression);
      break;
    case AST_NODE_TYPES.ChainExpression:
      stack.push(node.expression);
      break;
    default:
      break;
  }
}

function isReadInConditional(body: TSESTree.BlockStatement, varName: string, cleanupRange: TSESTree.Range): boolean {
  const stack: TSESTree.Node[] = [...body.body];
  while (stack.length > 0) {
    const node = stack.pop()!;
    // Skip the cleanup function
    if (node.range[0] >= cleanupRange[0] && node.range[1] <= cleanupRange[1]) continue;

    if (
      (node.type === AST_NODE_TYPES.IfStatement || node.type === AST_NODE_TYPES.ConditionalExpression)
      && referencesVar(node.test, varName)
    ) {
      return true;
    }
    if (
      node.type === AST_NODE_TYPES.LogicalExpression
      && (referencesVar(node.left, varName) || referencesVar(node.right, varName))
    ) {
      return true;
    }

    pushChildren(node, stack);
  }
  return false;
}

export default createRule({
  name: 'react-prefer-foxact-use-abortable-effect',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect cancel-flag race condition patterns in useEffect and suggest `foxact/use-abortable-effect` with `signal.aborted` instead.'
    },
    messages: {
      preferAbortableEffect: 'Do not use a cancel flag to avoid race conditions in `useEffect`. Use `useAbortableEffect` from `foxact/use-abortable-effect` with `signal.aborted` instead.'
    },
    schema: []
  },
  create: (context) => ({
    CallExpression(node) {
      if (!isUseEffectCall(node)) return;

      const callback = getEffectCallback(node);
      if (callback == null) return;

      // Skip if callback has parameters (custom effect hook w/ signal support)
      if (callback.params.length > 0) return;

      if (callback.body.type !== AST_NODE_TYPES.BlockStatement) return;

      const cancelVars = findCancelVarDeclarations(callback.body);
      if (cancelVars.length === 0) return;

      const cleanup = getReturnedFunction(callback);
      if (cleanup == null) return;

      for (const varName of cancelVars) {
        if (
          cleanupAssignsTrue(cleanup, varName)
          && isReadInConditional(callback.body, varName, cleanup.range)
        ) {
          context.report({
            node,
            messageId: 'preferAbortableEffect'
          });
          return;
        }
      }
    }
  })
});
