import type { RuleContext } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint, ASTUtils } from '@typescript-eslint/utils';

// --- Scope helpers ---

export function *getAllScopeRefs(
  scope: TSESLint.Scope.Scope
): Generator<TSESLint.Scope.Reference> {
  const stack: TSESLint.Scope.Scope[] = [scope];
  while (stack.length > 0) {
    const current = stack.pop()!;
    yield *current.references;
    for (let i = current.childScopes.length - 1; i >= 0; i--) {
      stack.push(current.childScopes[i]);
    }
  }
}

export function resolveToArrayExpression(
  context: RuleContext<string, unknown[]>,
  node: TSESTree.Node
): TSESTree.ArrayExpression | null {
  if (node.type === AST_NODE_TYPES.ArrayExpression) return node;
  if (node.type !== AST_NODE_TYPES.Identifier) return null;

  let current: TSESTree.Identifier = node;
  for (;;) {
    const scope = context.sourceCode.getScope(current);
    const variable = ASTUtils.findVariable(scope, current.name);
    if (variable == null) return null;
    const def = variable.defs[0];
    if (def.type !== TSESLint.Scope.DefinitionType.Variable || def.node.init == null) return null;
    if (def.node.init.type === AST_NODE_TYPES.ArrayExpression) return def.node.init;
    if (def.node.init.type === AST_NODE_TYPES.Identifier) {
      current = def.node.init;
      continue;
    }
    return null;
  }
}

// --- AST helpers ---
const isUseEffectNames = (name: string) => name.startsWith('use') && name.endsWith('Effect');

export function isUseEffectCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) return isUseEffectNames(callee.name);
  if (
    callee.type === AST_NODE_TYPES.MemberExpression
    && callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return isUseEffectNames(callee.property.name);
  }
  return false;
}

const isUseStateLikeNames = (name: string) => name.startsWith('use') && name.endsWith('State');
export function isUseStateLikeCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) return isUseStateLikeNames(callee.name);
  if (
    callee.type === AST_NODE_TYPES.MemberExpression
    && callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return isUseStateLikeNames(callee.property.name);
  }
  return false;
}

export function findParentNode(
  node: TSESTree.Node,
  predicate: (n: TSESTree.Node) => boolean
): TSESTree.Node | null {
  let current = node.parent ?? null;
  while (current != null) {
    if (predicate(current)) return current;
    current = current.parent ?? null;
  }
  return null;
}
