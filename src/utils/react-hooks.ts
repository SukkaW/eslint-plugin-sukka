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

// --- Type aliases ---

export type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

// --- Naming conventions ---

// 'A'(65) through 'Z'(90)
export function isComponentName(name: string): boolean {
  const firstChar = name.codePointAt(0);
  return firstChar != null && firstChar >= 65 && firstChar <= 90;
}

export function isHookName(name: string): boolean {
  if (name === 'use') return true;
  if (!name.startsWith('use')) return false;
  // 'A'(65) through 'Z'(90): use followed by uppercase letter
  const ch = name.codePointAt(3);
  return ch != null && ch >= 65 && ch <= 90;
}

export function isComponentOrHookName(name: string): boolean {
  return isComponentName(name) || isHookName(name);
}

const WRAPPER_COMPONENT_NAMES = new Set(['memo', 'forwardRef']);

export function isWrapperComponentCall(node: TSESTree.CallExpression): boolean {
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return WRAPPER_COMPONENT_NAMES.has(callee.name);
  }
  if (
    callee.type === AST_NODE_TYPES.MemberExpression
    && callee.object.type === AST_NODE_TYPES.Identifier
    && callee.object.name === 'React'
    && callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return WRAPPER_COMPONENT_NAMES.has(callee.property.name);
  }
  return false;
}

// --- Component detection ---

export function getWrapperComponentName(callExpr: TSESTree.CallExpression): string | null {
  if (!isWrapperComponentCall(callExpr)) return null;

  const parent = callExpr.parent;
  if (
    parent.type === AST_NODE_TYPES.VariableDeclarator
    && parent.id.type === AST_NODE_TYPES.Identifier
    && isComponentName(parent.id.name)
  ) {
    return parent.id.name;
  }

  if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return 'default';
  }

  return null;
}

export function getComponentName(node: FunctionNode): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id != null) {
    return isComponentName(node.id.name) ? node.id.name : null;
  }

  if (node.type === AST_NODE_TYPES.FunctionExpression && node.id != null && isComponentName(node.id.name)) {
    return node.id.name;
  }

  const parent = node.parent;

  if (
    parent.type === AST_NODE_TYPES.VariableDeclarator
    && parent.id.type === AST_NODE_TYPES.Identifier
    && isComponentName(parent.id.name)
  ) {
    return parent.id.name;
  }

  if (
    parent.type === AST_NODE_TYPES.CallExpression
    && parent.arguments[0] === node
  ) {
    return getWrapperComponentName(parent);
  }

  if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return 'default';
  }

  return null;
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

export function isUseStateCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === 'useState';
  if (
    callee.type === AST_NODE_TYPES.MemberExpression
    && callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name === 'useState';
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

export type EffectCallback = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

export function isRangeInside(range: TSESTree.Range, outer: TSESTree.Range) {
  return outer[0] <= range[0] && range[1] <= outer[1];
}

export function getEffectCallback(node: TSESTree.CallExpression): EffectCallback | null {
  return node.arguments.length > 0 && ASTUtils.isFunction(node.arguments[0])
    ? node.arguments[0]
    : null;
}

export function getNearestFunctionAncestor(node: TSESTree.Node): FunctionNode | null {
  let current = node.parent ?? null;
  while (current != null) {
    if (ASTUtils.isFunction(current)) return current;
    current = current.parent ?? null;
  }
  return null;
}
