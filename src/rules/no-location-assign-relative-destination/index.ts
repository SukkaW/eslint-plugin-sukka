import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree, TSESLint } from '@typescript-eslint/utils';

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

function getLocationPrefix(identifier: TSESTree.Identifier): string {
  return identifier.name === 'location' ? 'location' : `${identifier.name}.location`;
}

/**
 * Determines whether the given identifier is a reference to a global variable.
 *
 * Ported from ESLint 9.29+ `sourceCode.isGlobalReference` — @typescript-eslint/utils@8
 * does not expose the method on its `SourceCode` type yet.
 *
 * @see https://github.com/eslint/eslint/blob/2b252be80f362cca7be3326a6dbe958680fdfe9a/lib/languages/js/source-code/source-code.js#L730
 */
function isGlobalReference(
  scopeManager: TSESLint.Scope.ScopeManager,
  node: TSESTree.Node
): boolean {
  if (node.type !== AST_NODE_TYPES.Identifier) return false;

  const variable = scopeManager.scopes[0].set.get(node.name);
  if (!variable || variable.defs.length > 0) return false;

  return variable.references.some(({ identifier }) => identifier === node);
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
    const { scopeManager } = context.sourceCode;
    if (!scopeManager) return {};

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
        if (!isGlobalReference(scopeManager, rootIdentifier)) return;

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
        if (!isGlobalReference(scopeManager, rootIdentifier)) return;

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
