import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { Scope } from '@typescript-eslint/utils/ts-eslint';
import { findVariable } from '@typescript-eslint/utils/ast-utils';
import { isUseEffectCall, isUseStateLikeCall } from '@/utils/react-hooks';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';

/** Returns true if the node (or any of its descendants) is an Identifier whose name is in depVarNames. */
function referencesAnyDepVar(node: TSESTree.Node, depVarNames: Set<string>): boolean {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      return depVarNames.has(node.name);
    case AST_NODE_TYPES.BinaryExpression:
    case AST_NODE_TYPES.LogicalExpression:
    case AST_NODE_TYPES.AssignmentExpression:
      return referencesAnyDepVar(node.left, depVarNames) || referencesAnyDepVar(node.right, depVarNames);
    case AST_NODE_TYPES.UnaryExpression:
    case AST_NODE_TYPES.AwaitExpression:
    case AST_NODE_TYPES.SpreadElement:
      return referencesAnyDepVar(node.argument, depVarNames);
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSInstantiationExpression:
      return referencesAnyDepVar(node.expression, depVarNames);
    case AST_NODE_TYPES.ConditionalExpression:
      return referencesAnyDepVar(node.test, depVarNames)
        || referencesAnyDepVar(node.consequent, depVarNames)
        || referencesAnyDepVar(node.alternate, depVarNames);
    case AST_NODE_TYPES.MemberExpression:
      return referencesAnyDepVar(node.object, depVarNames)
        || (node.computed && referencesAnyDepVar(node.property, depVarNames));
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression:
      return node.arguments.some((arg) => referencesAnyDepVar(arg, depVarNames));
    case AST_NODE_TYPES.SequenceExpression:
      return node.expressions.some((expr) => referencesAnyDepVar(expr, depVarNames));
    case AST_NODE_TYPES.TemplateLiteral:
      return node.expressions.some((expr) => referencesAnyDepVar(expr, depVarNames));
    default:
      return false;
  }
}

/**
 * Returns true if the given setter call node is nested inside a conditional
 * (IfStatement, ConditionalExpression, or LogicalExpression) whose test/condition
 * references one of the dep variables. Such a guard means the setter won't always
 * fire, so it cannot create an unconditional infinite loop.
 */
function isGuardedByDepCondition(
  node: TSESTree.Node,
  depVarNames: Set<string>,
  cbStart: number,
  cbEnd: number
): boolean {
  let current = node.parent ?? null;
  while (current != null) {
    if (current.range[0] < cbStart || current.range[1] > cbEnd) break;
    switch (current.type) {
      case AST_NODE_TYPES.IfStatement: {
        if (referencesAnyDepVar(current.test, depVarNames)) return true;
        break;
      }
      case AST_NODE_TYPES.ConditionalExpression: {
        if (referencesAnyDepVar(current.test, depVarNames)) return true;
        break;
      }
      case AST_NODE_TYPES.LogicalExpression: {
        if (referencesAnyDepVar(current.left, depVarNames)) return true;
        break;
      }
      // no default
    }
    current = current.parent ?? null;
  }
  return false;
}

export type MessageId = 'circularEffect';

export default createRule({
  name: 'react-no-circular-effect',
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect circular dependencies in React effects.'
    },
    messages: {
      circularEffect: 'Circular effect detected: this effect depends on {{depNames}} and updates {{targetNames}}, creating an infinite update loop.'
    },
    schema: []
  },
  create(context) {
    const setterToState = new Map<Scope.Variable, Scope.Variable>();
    const pendingEffects: TSESTree.CallExpression[] = [];

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (isUseStateLikeCall(node)) {
          const { parent } = node;
          if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.ArrayPattern) {
            const [stateEl, setterEl] = parent.id.elements;
            if (stateEl?.type === AST_NODE_TYPES.Identifier && setterEl?.type === AST_NODE_TYPES.Identifier) {
              const scope = context.sourceCode.getScope(node);
              const stateVar = findVariable(scope, stateEl.name);
              const setterVar = findVariable(scope, setterEl.name);
              if (stateVar != null && setterVar != null) {
                setterToState.set(setterVar, stateVar);
              }
            }
          }
          return;
        }

        if (isUseEffectCall(node)) {
          pendingEffects.push(node);
        }
      },

      'Program:exit': function () {
        interface EffectEdge {
          deps: Scope.Variable[],
          targets: Scope.Variable[],
          node: TSESTree.CallExpression
        }

        const stateVars = new Set(setterToState.values());
        const edges: EffectEdge[] = [];

        for (const node of pendingEffects) {
          if (node.arguments.length < 2) continue;

          const callback = node.arguments[0];
          const depsArg = node.arguments[1];

          const deps: Scope.Variable[] = [];
          if (depsArg.type === AST_NODE_TYPES.ArrayExpression) {
            for (const el of depsArg.elements) {
              if (el?.type === AST_NODE_TYPES.Identifier) {
                const scope = context.sourceCode.getScope(el);
                const v = findVariable(scope, el.name);
                if (v != null && stateVars.has(v)) {
                  deps.push(v);
                }
              }
            }
          }
          if (deps.length === 0) continue;

          const targets: Scope.Variable[] = [];
          const [cbStart, cbEnd] = callback.range;
          const depVarNames = new Set(deps.map((d) => d.name));
          for (const [setterVar, stateVar] of setterToState) {
            for (const ref of setterVar.references) {
              const [refStart, refEnd] = ref.identifier.range;
              if (refStart < cbStart || refEnd > cbEnd) continue;
              const { parent } = ref.identifier;
              if (parent?.type === AST_NODE_TYPES.CallExpression && parent.callee === ref.identifier) {
                if (!isGuardedByDepCondition(ref.identifier, depVarNames, cbStart, cbEnd)) {
                  targets.push(stateVar);
                }
                break;
              }
            }
          }
          if (targets.length === 0) continue;

          edges.push({ deps, targets, node });
        }

        const graph = new Map<Scope.Variable, Set<Scope.Variable>>();
        for (const { deps, targets } of edges) {
          for (const dep of deps) {
            for (const target of targets) {
              if (!graph.has(dep)) graph.set(dep, new Set());
              graph.get(dep)!.add(target);
            }
          }
        }

        const visited = new Set<Scope.Variable>();
        const inStack = new Set<Scope.Variable>();
        const inCycle = new Set<Scope.Variable>();

        function dfs(v: Scope.Variable): boolean {
          if (inStack.has(v)) return true;
          if (visited.has(v)) return false;
          visited.add(v);
          inStack.add(v);

          // eslint-disable-next-line sukka/no-single-return -- we need to clean up stack
          let foundCycle = false;
          for (const neighbor of graph.get(v) ?? []) {
            if (dfs(neighbor)) {
              inCycle.add(v);
              inCycle.add(neighbor);
              // eslint-disable-next-line sukka/no-single-return -- we need to clean up stack
              foundCycle = true;
              break;
            }
          }

          inStack.delete(v);
          // eslint-disable-next-line sukka/no-single-return -- we need to clean up stack
          return foundCycle;
        }

        for (const v of graph.keys()) dfs(v);
        if (inCycle.size === 0) return;

        for (const { deps, targets, node } of edges) {
          const cycleDeps = deps.filter((d) => inCycle.has(d));
          const cycleTargets = targets.filter((t) => inCycle.has(t));
          if (cycleDeps.length === 0 || cycleTargets.length === 0) continue;

          const depNames = fastStringArrayJoin(cycleDeps.map((d) => d.name), ', ');
          const targetNames = fastStringArrayJoin(cycleTargets.map((t) => t.name), ', ');
          context.report({
            node,
            messageId: 'circularEffect',
            data: {
              depNames,
              targetNames
            }
          });
        }
      }
    };
  }
});
