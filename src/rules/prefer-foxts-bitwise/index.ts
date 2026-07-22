import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalReference, isSimpleTarget } from '@/utils/ast';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

const IMPORT_SOURCE = 'foxts/bitwise';

function isZeroLiteral(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.Literal && node.value === 0;
}

// `a & b` directly in a boolean test position, where swapping the number for a
// boolean does not change behavior.
function isBooleanTestPosition(node: TSESTree.Node): boolean {
  const parent = node.parent;
  if (parent == null) return false;
  switch (parent.type) {
    case AST_NODE_TYPES.IfStatement:
    case AST_NODE_TYPES.WhileStatement:
    case AST_NODE_TYPES.DoWhileStatement:
    case AST_NODE_TYPES.ConditionalExpression:
    case AST_NODE_TYPES.ForStatement:
      return parent.test === node;
    default:
      return false;
  }
}

// Only bitwise patterns with a direct foxts/bitwise counterpart are reported.
// Raw `^`, shifts, standalone `~`, and value-context `&` (bit intersection)
// have no named util and are left alone.
export default createRule({
  name: 'prefer-foxts-bitwise',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw bitwise operator patterns that have a named `foxts/bitwise` counterpart (`getBit`, `setBit`, `deleteBit`, `missingBit`), which documents the intent.'
    },
    fixable: 'code',
    messages: {
      default: 'Do not use the raw bitwise operator `{{operator}}` here. Prefer `{{util}}` from `foxts/bitwise` instead.'
    },
    schema: []
  },
  create(context) {
    const getText = (n: TSESTree.Node) => {
      const text = context.sourceCode.getText(n);
      return n.type === AST_NODE_TYPES.SequenceExpression ? `(${text})` : text;
    };

    function report(
      reportNode: TSESTree.Node,
      operator: string,
      util: string,
      replaceNode: TSESTree.Node | null,
      args: TSESTree.Node[] = [],
      prefix = ''
    ) {
      context.report({
        node: reportNode,
        messageId: 'default',
        data: { operator, util },
        fix: replaceNode == null
          ? null
          : function *(fixer) {
            yield *ensureNamedImport(fixer, context.sourceCode, IMPORT_SOURCE, util);
            yield fixer.replaceText(replaceNode, `${prefix}${util}(${args.map(getText).join(', ')})`);
          }
      });
    }

    return {
      BinaryExpression(node) {
        // a | b → setBit(a, b)
        if (node.operator === '|') {
          // `x | 0` / `0 | x` is the truncate-to-int32 idiom, not a bit set —
          // it intends `Math.trunc`, so leave it alone.
          if (isZeroLiteral(node.left) || isZeroLiteral(node.right)) return;
          report(node, '|', 'setBit', node, [node.left, node.right]);
          return;
        }

        if (node.operator !== '&') return;

        // a & ~b → deleteBit(a, b)
        if (node.right.type === AST_NODE_TYPES.UnaryExpression && node.right.operator === '~') {
          report(node, '&', 'deleteBit', node, [node.left, node.right.argument]);
          return;
        }

        // ~b & a → deleteBit(a, b). The fix reverses evaluation order of the
        // operands, so only safe with side-effect-free operands.
        if (
          node.left.type === AST_NODE_TYPES.UnaryExpression
          && node.left.operator === '~'
          && isSimpleTarget(node.left.argument)
          && isSimpleTarget(node.right)
        ) {
          report(node, '&', 'deleteBit', node, [node.right, node.left.argument]);
          return;
        }

        const parent = node.parent;

        // (a & b) !== 0 → getBit(a, b) / (a & b) === 0 → missingBit(a, b)
        if (parent.type === AST_NODE_TYPES.BinaryExpression) {
          const other = parent.left === node ? parent.right : parent.left;
          if (isZeroLiteral(other)) {
            if (parent.operator === '!==' || parent.operator === '!=') {
              report(node, '&', 'getBit', parent, [node.left, node.right]);
              return;
            }
            if (parent.operator === '===' || parent.operator === '==') {
              report(node, '&', 'missingBit', parent, [node.left, node.right]);
              return;
            }
          }
          return;
        }

        // !(a & b) → missingBit(a, b), !!(a & b) → getBit(a, b)
        if (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === '!') {
          const grandparent = parent.parent;
          if (grandparent.type === AST_NODE_TYPES.UnaryExpression && grandparent.operator === '!') {
            report(node, '&', 'getBit', grandparent, [node.left, node.right]);
          } else {
            report(node, '&', 'missingBit', parent, [node.left, node.right]);
          }
          return;
        }

        // Boolean(a & b) → getBit(a, b)
        if (
          parent.type === AST_NODE_TYPES.CallExpression
          && parent.arguments.length === 1
          && parent.arguments[0] === node
          && parent.callee.type === AST_NODE_TYPES.Identifier
          && parent.callee.name === 'Boolean'
          && isGlobalReference(context.sourceCode, parent.callee)
        ) {
          report(node, '&', 'getBit', parent, [node.left, node.right]);
          return;
        }

        // if (a & b) → if (getBit(a, b))
        if (isBooleanTestPosition(node)) {
          report(node, '&', 'getBit', node, [node.left, node.right]);
        }

        // Value-context `&` (bit intersection) has no util counterpart — skip
      },

      AssignmentExpression(node) {
        // Repeating the target in the fix is only safe when it cannot trigger getters
        const fixable = node.left.type === AST_NODE_TYPES.Identifier;
        const prefix = fixable ? `${getText(node.left)} = ` : '';

        // a |= b → a = setBit(a, b)
        if (node.operator === '|=') {
          report(node, '|=', 'setBit', fixable ? node : null, [node.left, node.right], prefix);
          return;
        }

        // a &= ~b → a = deleteBit(a, b)
        if (
          node.operator === '&='
          && node.right.type === AST_NODE_TYPES.UnaryExpression
          && node.right.operator === '~'
        ) {
          report(node, '&=', 'deleteBit', fixable ? node : null, [node.left, node.right.argument], prefix);
        }

        // Other compound bitwise assignments have no util counterpart — skip
      }
    };
  }
});
