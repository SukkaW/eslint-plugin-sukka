import { createRule } from '@/utils/create-eslint-rule';
import type { RuleContext } from '@/utils/create-eslint-rule';
import { getEffectCallback, isUseEffectCall, isUseStateLikeCall } from '@/utils/react-hooks';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint, ASTUtils } from '@typescript-eslint/utils';

const WATCH_MESSAGE = 'Do not call the set function of useState synchronously in an effect. Respond directly at where the change happens, or find event handlers/callbacks. If it is a purely derived value, compute it within the render phase w/ `useMemo` instead of having separate states.';
const WATCH_WITH_PROPS_MESSAGE = `${WATCH_MESSAGE} If this needs to reset state from outside, always prefer \`key\` to force-reset a component state, or use \`foxact/use-component-will-receive-update\` as your last resort to change internal state based on props change.`;

function isSetStateCallee(
  context: RuleContext<string, unknown[]>,
  node: TSESTree.Node
): boolean {
  if (node.type !== AST_NODE_TYPES.Identifier) return false;

  const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node.name);
  if (variable == null) return false;

  const def = variable.defs.at(0);
  if (def?.type !== TSESLint.Scope.DefinitionType.Variable) return false;

  const declarator = def.node;
  if (declarator.id.type !== AST_NODE_TYPES.ArrayPattern) return false;
  if (declarator.init == null || !isUseStateLikeCall(declarator.init)) return false;

  // Must be the second element (the setter)
  return declarator.id.elements[1] === def.name;
}

function isDeferredContext(node: TSESTree.Node, boundary: TSESTree.Node): boolean {
  let current: TSESTree.Node = node;

  while (current !== boundary) {
    const parent = current.parent;
    if (parent == null) return false;

    // async function body — any setState inside is deferred
    if (ASTUtils.isFunction(current) && current.async) return true;

    if (parent.type === AST_NODE_TYPES.AwaitExpression) return true;

    if (
      parent.type === AST_NODE_TYPES.CallExpression
      && parent.arguments.includes(current as TSESTree.CallExpressionArgument)
    ) {
      const { callee } = parent;

      // setTimeout / setInterval / queueMicrotask
      if (
        callee.type === AST_NODE_TYPES.Identifier
        && (callee.name === 'setTimeout'
          || callee.name === 'setInterval'
          || callee.name === 'queueMicrotask'
          || callee.name === 'requestAnimationFrame'
          || callee.name === 'requestIdleCallback')
      ) {
        return true;
      }

      // .then() / .catch() / .finally() / .addEventListener()
      if (
        callee.type === AST_NODE_TYPES.MemberExpression
        && callee.property.type === AST_NODE_TYPES.Identifier
        && (callee.property.name === 'then'
          || callee.property.name === 'catch'
          || callee.property.name === 'finally'
          || callee.property.name === 'addEventListener')
      ) {
        return true;
      }
    }

    current = parent;
  }

  return false;
}

function hasPropDependency(
  effectNode: TSESTree.CallExpression
): boolean {
  if (effectNode.arguments.length < 2) return false;
  const depsArg = effectNode.arguments[1];
  if (depsArg.type !== AST_NODE_TYPES.ArrayExpression) return false;

  // Find the enclosing component/hook function
  let enclosingFunction: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | null = null;
  let current: TSESTree.Node | undefined = effectNode.parent;
  while (current != null) {
    if (ASTUtils.isFunction(current)) {
      enclosingFunction = current;
      break;
    }
    current = current.parent;
  }
  if (enclosingFunction == null || enclosingFunction.params.length === 0) return false;

  // Collect all parameter variables
  const paramVariables = new Set<string>();
  for (const param of enclosingFunction.params) {
    collectParamNames(param, paramVariables);
  }
  if (paramVariables.size === 0) return false;

  // Check if any dep references a param
  for (const element of depsArg.elements) {
    if (element == null || element.type === AST_NODE_TYPES.SpreadElement) continue;
    const rootName = getRootIdentifierName(element);
    if (rootName != null && paramVariables.has(rootName)) return true;
  }

  return false;
}

function collectParamNames(node: TSESTree.Node, names: Set<string>): void {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      names.add(node.name);
      break;
    case AST_NODE_TYPES.RestElement:
      collectParamNames(node.argument, names);
      break;
    case AST_NODE_TYPES.AssignmentPattern:
      collectParamNames(node.left, names);
      break;
    case AST_NODE_TYPES.ArrayPattern:
      for (const el of node.elements) {
        if (el != null) collectParamNames(el, names);
      }
      break;
    case AST_NODE_TYPES.ObjectPattern:
      for (const prop of node.properties) {
        if (prop.type === AST_NODE_TYPES.Property) {
          collectParamNames(prop.value, names);
        } else {
          collectParamNames(prop.argument, names);
        }
      }
      break;
    default:
      break;
  }
}

function getRootIdentifierName(node: TSESTree.Node): string | null {
  let current = node;
  while (true) {
    switch (current.type) {
      case AST_NODE_TYPES.Identifier:
        return current.name;
      case AST_NODE_TYPES.MemberExpression:
        current = current.object;
        break;
      case AST_NODE_TYPES.ChainExpression:
      case AST_NODE_TYPES.TSAsExpression:
      case AST_NODE_TYPES.TSNonNullExpression:
      case AST_NODE_TYPES.TSTypeAssertion:
      case AST_NODE_TYPES.TSSatisfiesExpression:
        current = current.expression;
        break;
      default:
        return null;
    }
  }
}

export default createRule({
  name: 'react-no-use-effect-watching',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow calling the set function of useState synchronously in an effect.'
    },
    messages: {
      watchState: WATCH_MESSAGE,
      watchStateWithProps: WATCH_WITH_PROPS_MESSAGE
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isSetStateCallee(context, node.callee)) return;

        // Walk up to find if we're inside a useEffect callback
        let current: TSESTree.Node | undefined = node.parent;
        while (current != null) {
          if (
            current.type === AST_NODE_TYPES.CallExpression
            && isUseEffectCall(current)
          ) {
            const callback = getEffectCallback(current);
            if (callback == null) break;

            if (!isDeferredContext(node, callback)) {
              context.report({
                node,
                messageId: hasPropDependency(current)
                  ? 'watchStateWithProps'
                  : 'watchState'
              });
            }
            return;
          }

          current = current.parent;
        }
      }
    };
  }
});
