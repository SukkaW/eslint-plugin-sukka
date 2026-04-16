import { createRule } from '@/utils/create-eslint-rule';
import type { TSESTree } from '@typescript-eslint/types';

export type MessageId = 'noLocationAssignRelativeDestination';

const GLOBAL_PREFIXES = new Set(['window', 'globalThis']);

/**
 * Returns true if the node represents `location`, `window.location`, or `globalThis.location`.
 */
function isLocationNode(node: TSESTree.Node): boolean {
  if (node.type === 'Identifier') {
    return node.name === 'location';
  }
  if (
    node.type === 'MemberExpression'
    && !node.computed
    && node.object.type === 'Identifier'
    && GLOBAL_PREFIXES.has((node.object as TSESTree.Identifier).name)
    && node.property.type === 'Identifier'
    && (node.property as TSESTree.Identifier).name === 'location'
  ) {
    return true;
  }
  return false;
}

function getLocationPrefix(node: TSESTree.Node): string {
  if (node.type === 'Identifier') {
    return (node as TSESTree.Identifier).name;
  }
  // window.location or globalThis.location
  const obj = (node as TSESTree.MemberExpression).object as TSESTree.Identifier;
  return `${obj.name}.location`;
}

// Matches absolute URLs: scheme: or protocol-relative //
const ABSOLUTE_URL_RE = /^(?:[a-zA-Z][a-zA-Z0-9+\-.]*:|\/\/)/;

function isRelativeUrl(value: string): boolean {
  return !ABSOLUTE_URL_RE.test(value);
}

/**
 * Extracts the leading static string from a Literal or TemplateLiteral node.
 * Returns null when the value cannot be statically determined.
 */
function getStaticStringPrefix(node: TSESTree.Expression): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.quasis.length > 0) {
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
          callee.type !== 'MemberExpression'
          || callee.computed
          || callee.property.type !== 'Identifier'
          || (callee.property as TSESTree.Identifier).name !== 'assign'
          || !isLocationNode(callee.object)
        ) return;

        const firstArg = args[0];
        if (!firstArg || firstArg.type === 'SpreadElement') return;

        const value = getStaticStringPrefix(firstArg as TSESTree.Expression);
        if (value !== null && isRelativeUrl(value)) {
          context.report({
            node,
            messageId: 'noLocationAssignRelativeDestination',
            data: { method: `${getLocationPrefix(callee.object)}.assign()` }
          });
        }
      },

      // location.href = '/path'
      // window.location.href = '/path'
      // globalThis.location.href = '/path'
      AssignmentExpression(node) {
        const { left, right } = node;
        if (
          left.type !== 'MemberExpression'
          || left.computed
          || left.property.type !== 'Identifier'
          || (left.property as TSESTree.Identifier).name !== 'href'
          || !isLocationNode(left.object)
        ) return;

        const value = getStaticStringPrefix(right);
        if (value !== null && isRelativeUrl(value)) {
          context.report({
            node,
            messageId: 'noLocationAssignRelativeDestination',
            data: { method: `${getLocationPrefix(left.object)}.href` }
          });
        }
      }
    };
  }
});
