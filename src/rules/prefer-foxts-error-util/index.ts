import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalReference } from '@/utils/ast';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import { getTypeFromTreeNode } from '../no-for-in-iterable';
import { getBit } from 'foxts/bitwise';

const ERROR_LIKE_NAMES = new Set(['err', 'error', 'e', 'ex', 'exception']);

function isErrorType(type: ts.Type): boolean {
  if (type.getSymbol()?.getName() === 'Error') {
    return true;
  }

  if (type.isUnion()) {
    return type.types.some(isErrorType);
  }

  const bases = type.getBaseTypes();
  if (bases) {
    return bases.some(isErrorType);
  }

  return false;
}

function isCatchClauseParam(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node;
  while (current != null) {
    if (current.type === AST_NODE_TYPES.CatchClause) {
      return true;
    }
    if (current.type === AST_NODE_TYPES.FunctionDeclaration
      || current.type === AST_NODE_TYPES.FunctionExpression
      || current.type === AST_NODE_TYPES.ArrowFunctionExpression) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function looksLikeErrorVariable(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.Identifier) return false;
  return ERROR_LIKE_NAMES.has(node.name.toLowerCase());
}

function isAnyOrUnknown(type: ts.Type): boolean {
  const flags = type.getFlags();
  return getBit(flags, 1) // Any
    || getBit(flags, 2) // Unknown
    || getBit(flags, 32768); // Undefined (for undeclared variables)
}

function isConfirmedErrorType(
  node: TSESTree.Node,
  services: ParserServicesWithTypeInformation | null
): boolean {
  if (services == null) return false;
  try {
    const type = getTypeFromTreeNode(node, services);
    return isErrorType(type);
  } catch {
    return false;
  }
}

function isErrorVariable(
  node: TSESTree.Node,
  services: ParserServicesWithTypeInformation | null
): boolean {
  if (node.type !== AST_NODE_TYPES.Identifier) return false;

  if (isCatchClauseParam(node)) return true;

  if (services != null) {
    try {
      const type = getTypeFromTreeNode(node, services);
      if (isErrorType(type)) return true;
      if (!isAnyOrUnknown(type)) return false;
    } catch {
      // no type info, fall through to name heuristic
    }
  }

  return looksLikeErrorVariable(node);
}

const supportedComparisonOperators = new Set(['===', '!==', '==', '!=']);

export default createRule({
  name: 'prefer-foxts-error-util',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `foxts/is-error-like-object` or `Error.isError()` over `instanceof Error`, and `foxts/extract-error-message` over manual error message extraction.'
    },
    fixable: 'code',
    messages: {
      preferIsError: 'Prefer `isErrorLikeObject` from `foxts/is-error-like-object` or `Error.isError()` over `instanceof Error`.',
      preferIsErrorToString: 'Prefer `isErrorLikeObject` from `foxts/is-error-like-object` or `Error.isError()` over `Object.prototype.toString.call()` comparison.',
      preferExtractErrorMessage: 'Prefer `extractErrorMessage` from `foxts/extract-error-message` over manually extracting error messages.'
    },
    schema: []
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const hasTypeInfo = !!services?.program;
    const typedServices = hasTypeInfo ? services as ParserServicesWithTypeInformation : null;

    function isGlobalErrorIdentifier(node: TSESTree.Node) {
      return node.type === AST_NODE_TYPES.Identifier
        && node.name === 'Error'
        && isGlobalReference(context.sourceCode, node);
    }

    function isGlobalObjectIdentifier(node: TSESTree.Node) {
      return node.type === AST_NODE_TYPES.Identifier
        && node.name === 'Object'
        && isGlobalReference(context.sourceCode, node);
    }

    function isObjectPrototypeToString(node: TSESTree.Node): boolean {
      return node.type === AST_NODE_TYPES.MemberExpression
        && !node.computed
        && node.property.type === AST_NODE_TYPES.Identifier
        && node.property.name === 'toString'
        && node.object.type === AST_NODE_TYPES.MemberExpression
        && !node.object.computed
        && node.object.property.type === AST_NODE_TYPES.Identifier
        && node.object.property.name === 'prototype'
        && isGlobalObjectIdentifier(node.object.object);
    }

    function getToStringCallArgument(node: TSESTree.CallExpression): TSESTree.Node | null {
      if (
        node.callee.type !== AST_NODE_TYPES.MemberExpression
        || node.callee.computed
        || node.callee.property.type !== AST_NODE_TYPES.Identifier
        || node.callee.property.name !== 'call'
        || node.arguments.length !== 1
      ) {
        return null;
      }

      if (isObjectPrototypeToString(node.callee.object)) {
        return node.arguments[0];
      }

      return null;
    }

    const checkSide = (
      literalSide: TSESTree.Node,
      callSide: TSESTree.Node
    ): TSESTree.Node | null => {
      if (
        literalSide.type === AST_NODE_TYPES.Literal
        && literalSide.value === '[object Error]'
        && callSide.type === AST_NODE_TYPES.CallExpression
      ) {
        return getToStringCallArgument(callSide);
      }
      return null;
    };

    return {
      // instanceof Error
      BinaryExpression(node) {
        if (node.operator === 'instanceof' && isGlobalErrorIdentifier(node.right)) {
          const argText = context.sourceCode.getText(node.left);
          context.report({
            node,
            messageId: 'preferIsError',
            fix: (fixer) => fixer.replaceText(
              node,
              `isErrorLikeObject(${node.left.type === AST_NODE_TYPES.SequenceExpression ? `(${argText})` : argText})`
            )
          });
          return;
        }

        // Object.prototype.toString.call(x) === '[object Error]'
        if (!supportedComparisonOperators.has(node.operator)) return;

        const argument = checkSide(node.right, node.left) ?? checkSide(node.left, node.right);
        if (argument == null) return;

        const negate = node.operator === '!==' || node.operator === '!=';
        const argText = context.sourceCode.getText(argument);
        context.report({
          node,
          messageId: 'preferIsErrorToString',
          fix: (fixer) => fixer.replaceText(
            node,
            `${negate ? '!' : ''}isErrorLikeObject(${argument.type === AST_NODE_TYPES.SequenceExpression ? `(${argText})` : argText})`
          )
        });
      },

      // String(error) / JSON.stringify(error) / error.toString() / error.message
      CallExpression(node) {
        // String(error)
        if (
          node.callee.type === AST_NODE_TYPES.Identifier
          && node.callee.name === 'String'
          && isGlobalReference(context.sourceCode, node.callee)
          && node.arguments.length === 1
          && isErrorVariable(node.arguments[0], typedServices)
        ) {
          context.report({ node, messageId: 'preferExtractErrorMessage' });
          return;
        }

        // JSON.stringify(error)
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression
          && !node.callee.computed
          && node.callee.object.type === AST_NODE_TYPES.Identifier
          && node.callee.object.name === 'JSON'
          && isGlobalReference(context.sourceCode, node.callee.object)
          && node.callee.property.type === AST_NODE_TYPES.Identifier
          && node.callee.property.name === 'stringify'
          && node.arguments.length >= 1
          && isErrorVariable(node.arguments[0], typedServices)
        ) {
          context.report({ node, messageId: 'preferExtractErrorMessage' });
          return;
        }

        // error.toString()
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression
          && !node.callee.computed
          && node.callee.property.type === AST_NODE_TYPES.Identifier
          && node.callee.property.name === 'toString'
          && node.arguments.length === 0
          && isErrorVariable(node.callee.object, typedServices)
        ) {
          context.report({ node, messageId: 'preferExtractErrorMessage' });
        }
      },

      // error.message — only when the type is NOT confirmed Error
      MemberExpression(node) {
        if (
          !node.computed
          && node.property.type === AST_NODE_TYPES.Identifier
          && node.property.name === 'message'
          && isErrorVariable(node.object, typedServices)
          && node.parent.type !== AST_NODE_TYPES.MemberExpression
          && !isConfirmedErrorType(node.object, typedServices)
        ) {
          context.report({ node, messageId: 'preferExtractErrorMessage' });
        }
      }
    };
  }
});
