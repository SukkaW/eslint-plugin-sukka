import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { ASTUtils, TSESLint } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';

export type MessageId = 'noLocationAssignRelativeDestination';

const GLOBAL_PREFIXES = new Set(['window', 'globalThis']);

/**
 * If the node is `location`, `window.location`, or `globalThis.location`, returns the root
 * identifier whose binding must resolve to a global for the pattern to apply.
 * Returns null if the shape doesn't match.
 */
function getLocationRootIdentifier(node: TSESTree.Node): TSESTree.Identifier | null {
  if (node.type === AST_NODE_TYPES.Identifier && node.name === 'location') {
    return node;
  }
  if (
    node.type === AST_NODE_TYPES.MemberExpression
    && !node.computed
    && node.object.type === AST_NODE_TYPES.Identifier
    && GLOBAL_PREFIXES.has(node.object.name)
    && node.property.type === AST_NODE_TYPES.Identifier
    && node.property.name === 'location'
  ) {
    return node.object;
  }
  return null;
}

/**
 * An identifier refers to a browser global when either:
 *   - no scope declares it (implicit global, findVariable returns null), or
 *   - the variable lives in the global scope AND has no user-written definitions
 *     (i.e. it's an ESLint-known builtin, not a script-level `var` that happens to
 *     hoist into the global scope).
 */
function isGlobalBinding(scope: TSESLint.Scope.Scope, identifier: TSESTree.Identifier): boolean {
  const variable = ASTUtils.findVariable(scope, identifier);
  if (!variable) return true;
  return variable.scope.type === TSESLint.Scope.ScopeType.global && variable.defs.length === 0;
}

function getLocationPrefix(identifier: TSESTree.Identifier): string {
  return identifier.name === 'location' ? 'location' : `${identifier.name}.location`;
}

// Matches absolute URLs: scheme: or protocol-relative //
const ABSOLUTE_URL_RE = /^(?:[a-z][\d+.a-z-]*:|\/\/)/i;

function isRelativeUrl(value: string): boolean {
  return !ABSOLUTE_URL_RE.test(value);
}

/**
 * Extracts the leading static string from a Literal or TemplateLiteral node.
 * Returns null when the value cannot be statically determined.
 */
function getStaticStringPrefix(node: TSESTree.Expression): string | null {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === AST_NODE_TYPES.TemplateLiteral && node.quasis.length > 0) {
    // cooked can be null when the template contains an invalid escape sequence
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

export default createRule({
  name: 'no-location-assign-relative-destination',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `location.href =` and `location.assign()` for relative-URL navigation; use the framework\'s navigation API instead'
    },
    schema: [],
    messages: {
      noLocationAssignRelativeDestination:
        'Do not use `{{method}}` to navigate to a relative destination. '
        + 'Use your framework\'s navigation API instead '
        + '(e.g. React Router\'s `navigate()` / `useNavigate()`, or Next.js\'s `redirect()` for during any components\' render phase / `useRouter().push() for event handlers in client components` from `next/navigation`).'
    }
  },
  create(context) {
    return {
      // location.assign('/path')
      // window.location.assign('/path')
      // globalThis.location.assign('/path')
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression
          || callee.computed
          || callee.property.type !== AST_NODE_TYPES.Identifier
          || callee.property.name !== 'assign'
        ) return;

        const rootIdentifier = getLocationRootIdentifier(callee.object);
        if (!rootIdentifier) return;
        if (!isGlobalBinding(context.sourceCode.getScope(node), rootIdentifier)) return;

        const firstArg = args[0];
        if (!firstArg || firstArg.type === AST_NODE_TYPES.SpreadElement) return;

        const value = getStaticStringPrefix(firstArg);
        if (value !== null && isRelativeUrl(value)) {
          context.report({
            node,
            messageId: 'noLocationAssignRelativeDestination',
            data: { method: `${getLocationPrefix(rootIdentifier)}.assign()` }
          });
        }
      },

      // location.href = '/path'
      // window.location.href = '/path'
      // globalThis.location.href = '/path'
      AssignmentExpression(node) {
        const { left, right } = node;
        if (
          left.type !== AST_NODE_TYPES.MemberExpression
          || left.computed
          || left.property.type !== AST_NODE_TYPES.Identifier
          || left.property.name !== 'href'
        ) return;

        const rootIdentifier = getLocationRootIdentifier(left.object);
        if (!rootIdentifier) return;
        if (!isGlobalBinding(context.sourceCode.getScope(node), rootIdentifier)) return;

        const value = getStaticStringPrefix(right);
        if (value !== null && isRelativeUrl(value)) {
          context.report({
            node,
            messageId: 'noLocationAssignRelativeDestination',
            data: { method: `${getLocationPrefix(rootIdentifier)}.href` }
          });
        }
      }
    };
  }
});
