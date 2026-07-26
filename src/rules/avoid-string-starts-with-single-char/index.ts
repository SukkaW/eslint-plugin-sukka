import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

function isSingleCharStringLiteral(node: TSESTree.Node): node is TSESTree.Literal & { value: string } {
  return node.type === AST_NODE_TYPES.Literal
    && typeof node.value === 'string'
    && node.value.length === 1;
}

// An optional call is wrapped in a `ChainExpression`, which stands between the
// call and the syntax that actually consumes its value.
function outermostChain(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;
  while (current.parent?.type === AST_NODE_TYPES.ChainExpression) {
    current = current.parent;
  }
  return current;
}

// A position where only the truthiness of the value is observed, so the
// `undefined` a short-circuited `?.startsWith()` yields is indistinguishable
// from the `false` that `?.[0] === "x"` yields.
function isBooleanPosition(node: TSESTree.Node): boolean {
  const self = outermostChain(node);
  const parent = self.parent;
  if (parent == null) return false;
  switch (parent.type) {
    case AST_NODE_TYPES.IfStatement:
    case AST_NODE_TYPES.WhileStatement:
    case AST_NODE_TYPES.DoWhileStatement:
    case AST_NODE_TYPES.ConditionalExpression:
    case AST_NODE_TYPES.ForStatement:
      return parent.test === self;
    case AST_NODE_TYPES.UnaryExpression:
      return parent.operator === '!';
    case AST_NODE_TYPES.LogicalExpression:
      // `a && x?.startsWith("c")` only forwards the value when it is the
      // right operand, so only the left operand is a pure test position.
      return parent.operator !== '??' && parent.left === self;
    default:
      return false;
  }
}

export default createRule({
  name: 'avoid-string-starts-with-single-char',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `str[0] === "x"` over `str.startsWith("x")` when checking a single character.'
    },
    fixable: 'code',
    messages: {
      default: 'Use `{{replacement}}` instead of `{{original}}`. Indexing is faster than `startsWith` for a single character.'
    },
    schema: []
  },
  create(context) {
    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="startsWith"]': (node: TSESTree.CallExpression) => {
        if (node.arguments.length !== 1) return;
        const arg = node.arguments[0];
        if (!isSingleCharStringLiteral(arg)) return;

        const callee = node.callee as TSESTree.MemberExpression;
        const objectText = context.sourceCode.getText(callee.object);
        const charText = context.sourceCode.getText(arg);

        const needsParens = callee.object.type === AST_NODE_TYPES.AwaitExpression
          || callee.object.type === AST_NODE_TYPES.BinaryExpression
          || callee.object.type === AST_NODE_TYPES.LogicalExpression
          || callee.object.type === AST_NODE_TYPES.AssignmentExpression
          || callee.object.type === AST_NODE_TYPES.SequenceExpression
          || callee.object.type === AST_NODE_TYPES.ConditionalExpression;

        // `str?.startsWith("c")` short-circuits on a nullish receiver, and
        // `str.startsWith?.("c")` guards a missing method. Both guards are lost
        // once the call becomes an index access, so it has to stay optional.
        // A `?.` earlier in the chain (`a?.b.startsWith("c")`) already sits in
        // `objectText` and short-circuits the whole access, so it needs nothing.
        const optional = callee.optional || node.optional;
        const accessor = optional ? '?.[0]' : '[0]';

        const indexedAccess = needsParens ? `(${objectText})${accessor}` : `${objectText}${accessor}`;
        const replacement = `${indexedAccess} === ${charText}`;

        // An optional call is wrapped in a `ChainExpression`; the wrapper is
        // what `!` and the surrounding syntax actually see, and replacing only
        // the inner call would leave the stale wrapper behind.
        const self = outermostChain(node);
        const negated = self.parent?.type === AST_NODE_TYPES.UnaryExpression
          && self.parent.operator === '!';

        // A short-circuited `?.startsWith()` evaluates to `undefined`, whereas
        // the indexed rewrite evaluates to `false`. That difference is only
        // unobservable where the value is consumed as a boolean, so elsewhere
        // the finding is reported without an autofix. `!x` coerces to a real
        // boolean whatever the surrounding context, so a negated match is
        // always safe; otherwise the call's own position decides.
        const fixable = !optional || negated || isBooleanPosition(node);

        if (negated) {
          const negatedTarget = self.parent!;
          const negatedReplacement = `${indexedAccess} !== ${charText}`;
          context.report({
            node: negatedTarget,
            messageId: 'default',
            data: {
              replacement: negatedReplacement,
              original: context.sourceCode.getText(negatedTarget)
            },
            fix: fixable ? (fixer) => fixer.replaceText(negatedTarget, negatedReplacement) : null
          });
          return;
        }

        context.report({
          node: self,
          messageId: 'default',
          data: {
            replacement,
            original: context.sourceCode.getText(self)
          },
          fix: fixable ? (fixer) => fixer.replaceText(self, replacement) : null
        });
      }
    };
  }
});
