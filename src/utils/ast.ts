import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';
import { findVariable } from '@typescript-eslint/utils/ast-utils';

export const RE_NEWLINE = /\r\n?|\n/;

export function isGlobalReference(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Node | null
): boolean {
  if (node?.type !== AST_NODE_TYPES.Identifier) return false;

  const variable = findVariable(sourceCode.getScope(node), node);
  return variable == null || variable.defs.length === 0;
}

export function unwrapExpression(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (true) {
    switch (current.type) {
      case AST_NODE_TYPES.ChainExpression:
      case AST_NODE_TYPES.TSAsExpression:
      case AST_NODE_TYPES.TSNonNullExpression:
      case AST_NODE_TYPES.TSTypeAssertion:
      case AST_NODE_TYPES.TSSatisfiesExpression:
        current = current.expression;
        break;
      default:
        return current;
    }
  }
}

export function isGlobalMemberAccess(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Expression,
  objectName: string,
  propertyName: string
): boolean {
  const expression = unwrapExpression(node);
  return expression.type === AST_NODE_TYPES.MemberExpression
    && !expression.computed
    && expression.object.type === AST_NODE_TYPES.Identifier
    && expression.property.type === AST_NODE_TYPES.Identifier
    && isGlobalReference(sourceCode, expression.object)
    && expression.object.name === objectName
    && expression.property.name === propertyName;
}
