import { createRule } from '@/utils/create-eslint-rule';
import type { RuleContext } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { findVariable } from '@typescript-eslint/utils/ast-utils';
import { TSESLint } from '@typescript-eslint/utils';

const MESSAGE = 'Prefer `nullthrow`/`invariant` from `foxact/nullthrow`/`foxts/guard` over manual nullish guard-and-throw patterns.';

function isNullLiteral(node: TSESTree.Node) {
  return node.type === AST_NODE_TYPES.Literal && node.value === null;
}

function isUndefinedIdentifier(node: TSESTree.Node) {
  return node.type === AST_NODE_TYPES.Identifier && node.name === 'undefined';
}

function isIdentifierNamed(node: TSESTree.Node, name: string): node is TSESTree.Identifier {
  return node.type === AST_NODE_TYPES.Identifier && node.name === name;
}

function isTypeofUndefinedCheck(node: TSESTree.BinaryExpression, identifierName: string) {
  const leftIsTypeofIdentifier =
    node.left.type === AST_NODE_TYPES.UnaryExpression
    && node.left.operator === 'typeof'
    && isIdentifierNamed(node.left.argument, identifierName);
  const rightIsTypeofIdentifier =
    node.right.type === AST_NODE_TYPES.UnaryExpression
    && node.right.operator === 'typeof'
    && isIdentifierNamed(node.right.argument, identifierName);

  const leftIsUndefined = node.left.type === AST_NODE_TYPES.Literal && node.left.value === 'undefined';
  const rightIsUndefined = node.right.type === AST_NODE_TYPES.Literal && node.right.value === 'undefined';

  return (leftIsTypeofIdentifier && rightIsUndefined) || (rightIsTypeofIdentifier && leftIsUndefined);
}

function isExplicitNullishCheck(node: TSESTree.Expression, identifierName: string): boolean {
  if (node.type === AST_NODE_TYPES.LogicalExpression && node.operator === '||') {
    return isExplicitNullishCheck(node.left, identifierName)
      && isExplicitNullishCheck(node.right, identifierName);
  }

  if (node.type !== AST_NODE_TYPES.BinaryExpression) return false;
  if (node.operator !== '==' && node.operator !== '===') return false;

  if (isTypeofUndefinedCheck(node, identifierName)) return true;

  const leftMatches = isIdentifierNamed(node.left, identifierName) && (isNullLiteral(node.right) || isUndefinedIdentifier(node.right));
  const rightMatches = isIdentifierNamed(node.right, identifierName) && (isNullLiteral(node.left) || isUndefinedIdentifier(node.left));
  return leftMatches || rightMatches;
}

function isExplicitNonNullishCheck(node: TSESTree.Expression, identifierName: string): boolean {
  if (node.type === AST_NODE_TYPES.LogicalExpression && node.operator === '&&') {
    return isExplicitNonNullishCheck(node.left, identifierName)
      && isExplicitNonNullishCheck(node.right, identifierName);
  }

  if (node.type !== AST_NODE_TYPES.BinaryExpression) return false;
  if (node.operator !== '!=' && node.operator !== '!==') return false;

  const leftMatches = isIdentifierNamed(node.left, identifierName) && (isNullLiteral(node.right) || isUndefinedIdentifier(node.right));
  const rightMatches = isIdentifierNamed(node.right, identifierName) && (isNullLiteral(node.left) || isUndefinedIdentifier(node.left));
  return leftMatches || rightMatches;
}

function isDirectThrowBlock(node: TSESTree.Statement) {
  if (node.type === AST_NODE_TYPES.ThrowStatement) return true;
  return node.type === AST_NODE_TYPES.BlockStatement
    && node.body.length === 1
    && node.body[0].type === AST_NODE_TYPES.ThrowStatement;
}

function isDirectReturnOfIdentifier(node: TSESTree.Statement, identifierName: string) {
  if (
    node.type === AST_NODE_TYPES.ReturnStatement
    && node.argument?.type === AST_NODE_TYPES.Identifier
    && node.argument.name === identifierName
  ) {
    return true;
  }

  return node.type === AST_NODE_TYPES.BlockStatement
    && node.body.length === 1
    && node.body[0].type === AST_NODE_TYPES.ReturnStatement
    && node.body[0].argument?.type === AST_NODE_TYPES.Identifier
    && node.body[0].argument.name === identifierName;
}

function returnsIdentifierLater(node: TSESTree.IfStatement, identifierName: string) {
  const parent = node.parent;
  if (parent?.type !== AST_NODE_TYPES.BlockStatement) return false;

  const index = parent.body.indexOf(node);
  if (index < 0) return false;

  for (const statement of parent.body.slice(index + 1)) {
    if (
      statement.type === AST_NODE_TYPES.ReturnStatement
      && statement.argument?.type === AST_NODE_TYPES.Identifier
      && statement.argument.name === identifierName
    ) {
      return true;
    }
  }

  return false;
}

function throwsImmediatelyAfter(node: TSESTree.IfStatement) {
  const parent = node.parent;
  if (parent?.type !== AST_NODE_TYPES.BlockStatement) return false;

  const index = parent.body.indexOf(node);
  if (index < 0 || index + 1 >= parent.body.length) return false;

  return parent.body[index + 1].type === AST_NODE_TYPES.ThrowStatement;
}

function isNonParameterVariable(context: RuleContext<'default', unknown[]>, node: TSESTree.Identifier) {
  const variable = findVariable(context.sourceCode.getScope(node), node);
  if (variable == null || variable.defs.length === 0) return false;
  return variable.defs.every((def) => def.type !== TSESLint.Scope.DefinitionType.Parameter);
}

function getGuardedIdentifierName(
  context: RuleContext<'default', unknown[]>,
  node: TSESTree.IfStatement
): string | null {
  const { test } = node;

  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    if (
      test.left.type === AST_NODE_TYPES.Identifier
      && isExplicitNonNullishCheck(test, test.left.name)
      && isDirectReturnOfIdentifier(node.consequent, test.left.name)
      && throwsImmediatelyAfter(node)
    ) {
      return test.left.name;
    }

    if (
      test.right.type === AST_NODE_TYPES.Identifier
      && isExplicitNonNullishCheck(test, test.right.name)
      && isDirectReturnOfIdentifier(node.consequent, test.right.name)
      && throwsImmediatelyAfter(node)
    ) {
      return test.right.name;
    }
  }

  if (
    test.type === AST_NODE_TYPES.UnaryExpression
    && test.operator === '!'
    && test.argument.type === AST_NODE_TYPES.Identifier
    && isNonParameterVariable(context, test.argument)
    && returnsIdentifierLater(node, test.argument.name)
  ) {
    return test.argument.name;
  }

  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    if (test.left.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(test, test.left.name)) {
      return test.left.name;
    }

    if (test.right.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(test, test.right.name)) {
      return test.right.name;
    }

    if (
      test.left.type === AST_NODE_TYPES.UnaryExpression
      && test.left.operator === 'typeof'
      && test.left.argument.type === AST_NODE_TYPES.Identifier
      && isExplicitNullishCheck(test, test.left.argument.name)
    ) {
      return test.left.argument.name;
    }

    if (
      test.right.type === AST_NODE_TYPES.UnaryExpression
      && test.right.operator === 'typeof'
      && test.right.argument.type === AST_NODE_TYPES.Identifier
      && isExplicitNullishCheck(test, test.right.argument.name)
    ) {
      return test.right.argument.name;
    }
  }

  if (
    test.type === AST_NODE_TYPES.LogicalExpression
    && test.operator === '||'
  ) {
    const names = new Set<string>();
    const stack: TSESTree.Expression[] = [test];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.type === AST_NODE_TYPES.LogicalExpression && current.operator === '||') {
        stack.push(current.left, current.right);
        continue;
      }

      if (current.type === AST_NODE_TYPES.BinaryExpression) {
        if (current.left.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(current, current.left.name)) {
          names.add(current.left.name);
          continue;
        }
        if (current.right.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(current, current.right.name)) {
          names.add(current.right.name);
          continue;
        }
        if (
          current.left.type === AST_NODE_TYPES.UnaryExpression
          && current.left.operator === 'typeof'
          && current.left.argument.type === AST_NODE_TYPES.Identifier
          && isExplicitNullishCheck(current, current.left.argument.name)
        ) {
          names.add(current.left.argument.name);
          continue;
        }
        if (
          current.right.type === AST_NODE_TYPES.UnaryExpression
          && current.right.operator === 'typeof'
          && current.right.argument.type === AST_NODE_TYPES.Identifier
          && isExplicitNullishCheck(current, current.right.argument.name)
        ) {
          names.add(current.right.argument.name);
          continue;
        }
      }

      return null;
    }

    return names.size === 1 ? [...names][0] : null;
  }

  return null;
}

function getTestIdentifierName(test: TSESTree.Expression): string | null {
  // v == null / v === null / v === undefined / typeof v === 'undefined' etc.
  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    if (test.left.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(test, test.left.name)) {
      return test.left.name;
    }
    if (test.right.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(test, test.right.name)) {
      return test.right.name;
    }
  }

  // v == null || v === undefined
  if (test.type === AST_NODE_TYPES.LogicalExpression && test.operator === '||' && test.left.type === AST_NODE_TYPES.BinaryExpression && test.left.left.type === AST_NODE_TYPES.Identifier && isExplicitNullishCheck(test, test.left.left.name)) {
    return test.left.left.name;
  }

  return null;
}

function getNonNullTestIdentifierName(test: TSESTree.Expression): string | null {
  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    if (test.left.type === AST_NODE_TYPES.Identifier && isExplicitNonNullishCheck(test, test.left.name)) {
      return test.left.name;
    }
    if (test.right.type === AST_NODE_TYPES.Identifier && isExplicitNonNullishCheck(test, test.right.name)) {
      return test.right.name;
    }
  }

  return null;
}

function isIfElseNullthrowPattern(node: TSESTree.IfStatement): boolean {
  if (node.alternate == null) return false;

  // if (v == null) { throw } else { return v }
  const nullishName = getTestIdentifierName(node.test);
  if (
    nullishName != null
    && isDirectThrowBlock(node.consequent)
    && isDirectReturnOfIdentifier(node.alternate, nullishName)
  ) {
    return true;
  }

  // if (v != null) { return v } else { throw }
  const nonNullishName = getNonNullTestIdentifierName(node.test);
  return nonNullishName != null
    && isDirectReturnOfIdentifier(node.consequent, nonNullishName)
    && isDirectThrowBlock(node.alternate);
}

export default createRule({
  name: 'prefer-nullthrow',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `nullthrow` helpers over manual nullish guard-and-throw patterns.'
    },
    messages: {
      default: MESSAGE
    },
    schema: []
  },
  create(context) {
    return {
      IfStatement(node) {
        if (node.alternate == null) {
          const guardedIdentifierName = getGuardedIdentifierName(context, node);
          if (guardedIdentifierName == null) return;

          const isThrowThenReturnShape = isDirectThrowBlock(node.consequent);
          const isReturnThenThrowShape = throwsImmediatelyAfter(node);
          if (!isThrowThenReturnShape && !isReturnThenThrowShape) return;

          context.report({ node, messageId: 'default' });
        } else if (isIfElseNullthrowPattern(node)) {
          context.report({ node, messageId: 'default' });
        }
      }
    };
  }
});
