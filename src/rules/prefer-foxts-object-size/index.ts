import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalMemberAccess } from '@/utils/ast';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { RuleFix, RuleFixer } from '@typescript-eslint/utils/ts-eslint';

const IS_OBJECT_EMPTY_SOURCE = 'foxts/is-object-empty';
const IS_OBJECT_EMPTY_IMPORT = 'import { isObjectEmpty } from \'foxts/is-object-empty\';\n';
const KEY_LENGTH_SOURCE = 'foxts/property-count';
const KEY_LENGTH_IMPORT = 'import { keyLength } from \'foxts/property-count\';\n';

// Given `Object.keys(x).length <op> <value>`, decide whether the comparison is an
// emptiness check: "is empty" (true), "is not empty" (false), or neither (null).
// Only emptiness forms can use `isObjectEmpty`, which skips the numeric compare.
function interpretComparison(operator: string, value: number): boolean | null {
  switch (operator) {
    case '===':
    case '==':
      return value === 0 ? true : null;
    case '!==':
    case '!=':
      return value === 0 ? false : null;
    // length < 1 → empty
    case '<':
      return value === 1 ? true : null;
    // length <= 0 → empty
    case '<=':
      return value === 0 ? true : null;
    // length > 0 → not empty
    case '>':
      return value === 0 ? false : null;
    // length >= 1 → not empty
    case '>=':
      return value === 1 ? false : null;
    default:
      return null;
  }
}

function mirrorOperator(operator: TSESTree.BinaryExpression['operator']): TSESTree.BinaryExpression['operator'] {
  switch (operator) {
    case '<': return '>';
    case '<=': return '>=';
    case '>': return '<';
    case '>=': return '<=';
    default: return operator;
  }
}

// If `lengthNode` sits inside a comparison against a numeric literal, return the
// emptiness verdict (empty/not-empty) plus the whole comparison node to replace.
function matchEmptinessComparison(
  lengthNode: TSESTree.MemberExpression
): { comparison: TSESTree.BinaryExpression, isEmpty: boolean } | null {
  const parent = lengthNode.parent;
  if (parent.type !== AST_NODE_TYPES.BinaryExpression) return null;

  let literal: TSESTree.Node;
  let operator = parent.operator;
  if (parent.left === lengthNode) {
    literal = parent.right;
  } else if (parent.right === lengthNode) {
    literal = parent.left;
    // literal on the left mirrors the comparison direction
    operator = mirrorOperator(operator);
  } else {
    return null;
  }

  if (literal.type !== AST_NODE_TYPES.Literal || typeof literal.value !== 'number') return null;

  const isEmpty = interpretComparison(operator, literal.value);
  return isEmpty == null ? null : { comparison: parent, isEmpty };
}

export default createRule({
  name: 'prefer-foxts-object-size',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow counting object properties via `Object.keys(x).length`, which allocates an intermediate array. Use `keyLength` from `foxts/property-count`, or `isObjectEmpty` from `foxts/is-object-empty` for emptiness checks.'
    },
    fixable: 'code',
    messages: {
      preferIsObjectEmpty: 'Prefer `isObjectEmpty` from `foxts/is-object-empty` over an `Object.keys(x).length` emptiness check.',
      preferKeyLength: 'Prefer `keyLength` from `foxts/property-count` over `Object.keys(x).length`, which allocates an intermediate array just to count.'
    },
    schema: []
  },
  create(context) {
    const existingImports = new Set<string>();

    // Returns the target object node if `node` is `Object.keys(x).length`, else null.
    function getKeysLengthTarget(node: TSESTree.MemberExpression): TSESTree.Expression | null {
      if (
        node.computed
        || node.property.type !== AST_NODE_TYPES.Identifier
        || node.property.name !== 'length'
        || node.object.type !== AST_NODE_TYPES.CallExpression
      ) {
        return null;
      }

      const call = node.object;
      if (call.arguments.length !== 1) return null;
      const [arg] = call.arguments;
      if (arg.type === AST_NODE_TYPES.SpreadElement) return null;

      if (!isGlobalMemberAccess(context.sourceCode, call.callee, 'Object', 'keys')) return null;
      return arg;
    }

    function *ensureImport(fixer: RuleFixer, source: string, text: string): Generator<RuleFix> {
      if (existingImports.has(source)) return;
      existingImports.add(source);

      const program = context.sourceCode.ast;
      const lastImport = program.body.findLast((s) => s.type === AST_NODE_TYPES.ImportDeclaration);
      if (lastImport) {
        yield fixer.insertTextAfter(lastImport, '\n' + text);
      } else {
        yield fixer.insertTextBefore(program.body[0], text);
      }
    }

    function argText(target: TSESTree.Expression): string {
      const text = context.sourceCode.getText(target);
      return target.type === AST_NODE_TYPES.SequenceExpression ? `(${text})` : text;
    }

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === 'string') {
          existingImports.add(node.source.value);
        }
      },

      MemberExpression(node) {
        const target = getKeysLengthTarget(node);
        if (target == null) return;

        // `!Object.keys(x).length` → isObjectEmpty(x)
        if (node.parent.type === AST_NODE_TYPES.UnaryExpression && node.parent.operator === '!') {
          const unary = node.parent;
          context.report({
            node: unary,
            messageId: 'preferIsObjectEmpty',
            *fix(fixer) {
              yield *ensureImport(fixer, IS_OBJECT_EMPTY_SOURCE, IS_OBJECT_EMPTY_IMPORT);
              yield fixer.replaceText(unary, `isObjectEmpty(${argText(target)})`);
            }
          });
          return;
        }

        // `Object.keys(x).length === 0` and friends → isObjectEmpty(x) / !isObjectEmpty(x)
        const emptiness = matchEmptinessComparison(node);
        if (emptiness != null) {
          const { comparison, isEmpty } = emptiness;
          context.report({
            node: comparison,
            messageId: 'preferIsObjectEmpty',
            *fix(fixer) {
              yield *ensureImport(fixer, IS_OBJECT_EMPTY_SOURCE, IS_OBJECT_EMPTY_IMPORT);
              yield fixer.replaceText(comparison, `${isEmpty ? '' : '!'}isObjectEmpty(${argText(target)})`);
            }
          });
          return;
        }

        // Any other use of the count → keyLength(x), replacing only the `.length` expression
        context.report({
          node,
          messageId: 'preferKeyLength',
          *fix(fixer) {
            yield *ensureImport(fixer, KEY_LENGTH_SOURCE, KEY_LENGTH_IMPORT);
            yield fixer.replaceText(node, `keyLength(${argText(target)})`);
          }
        });
      }
    };
  }
});
