import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalMemberAccess, isSimpleTarget } from '@/utils/ast';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

const IMPORT_SOURCE = 'foxts/cast-array';

// Returns the argument of a (possibly negated) global `Array.isArray(x)` call.
function getIsArrayArgument(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Expression
): TSESTree.Expression | null {
  if (
    node.type !== AST_NODE_TYPES.CallExpression
    || node.arguments.length !== 1
    || node.arguments[0].type === AST_NODE_TYPES.SpreadElement
    || !isGlobalMemberAccess(sourceCode, node.callee, 'Array', 'isArray')
  ) {
    return null;
  }
  return node.arguments[0];
}

// Whether `node` is `[x]` — an array literal with `x` as its only element.
function isSingleElementArrayOf(node: TSESTree.Node, targetText: string, getText: (n: TSESTree.Node) => string): boolean {
  return node.type === AST_NODE_TYPES.ArrayExpression
    && node.elements.length === 1
    && node.elements[0] != null
    && node.elements[0].type !== AST_NODE_TYPES.SpreadElement
    && getText(node.elements[0]) === targetText;
}

export default createRule({
  name: 'prefer-foxts-cast-array',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow manually wrapping a value into a single-element array behind an `Array.isArray` check. Use `castArray` from `foxts/cast-array` instead (note: it also normalizes null/undefined to `[]`).'
    },
    fixable: 'code',
    messages: {
      default: 'Prefer `castArray` from `foxts/cast-array` over manually wrapping the value with an `Array.isArray` check.'
    },
    schema: []
  },
  create(context) {
    const getText = (n: TSESTree.Node) => context.sourceCode.getText(n);

    function *ensureImport(fixer: TSESLint.RuleFixer): Generator<TSESLint.RuleFix> {
      yield *ensureNamedImport(fixer, context.sourceCode, IMPORT_SOURCE, 'castArray');
    }

    return {
      // Array.isArray(x) ? x : [x]  /  !Array.isArray(x) ? [x] : x
      ConditionalExpression(node) {
        let test = node.test;
        let arrayBranch = node.alternate;
        let passthroughBranch = node.consequent;

        if (test.type === AST_NODE_TYPES.UnaryExpression && test.operator === '!') {
          test = test.argument;
          arrayBranch = node.consequent;
          passthroughBranch = node.alternate;
        }

        const target = getIsArrayArgument(context.sourceCode, test);
        if (target == null || !isSimpleTarget(target)) return;

        const targetText = getText(target);
        if (getText(passthroughBranch) !== targetText) return;
        if (!isSingleElementArrayOf(arrayBranch, targetText, getText)) return;

        context.report({
          node,
          messageId: 'default',
          *fix(fixer) {
            yield *ensureImport(fixer);
            yield fixer.replaceText(node, `castArray(${targetText})`);
          }
        });
      },

      // if (!Array.isArray(x)) { x = [x]; }  →  x = castArray(x);
      IfStatement(node) {
        if (node.alternate != null) return;
        if (node.test.type !== AST_NODE_TYPES.UnaryExpression || node.test.operator !== '!') return;

        const target = getIsArrayArgument(context.sourceCode, node.test.argument);
        if (target == null || !isSimpleTarget(target)) return;

        let statement: TSESTree.Statement = node.consequent;
        if (statement.type === AST_NODE_TYPES.BlockStatement) {
          if (statement.body.length !== 1) return;
          statement = statement.body[0];
        }
        if (
          statement.type !== AST_NODE_TYPES.ExpressionStatement
          || statement.expression.type !== AST_NODE_TYPES.AssignmentExpression
          || statement.expression.operator !== '='
        ) return;

        const { left, right } = statement.expression;
        const targetText = getText(target);
        if (getText(left) !== targetText) return;
        if (!isSingleElementArrayOf(right, targetText, getText)) return;

        context.report({
          node,
          messageId: 'default',
          *fix(fixer) {
            yield *ensureImport(fixer);
            yield fixer.replaceText(node, `${targetText} = castArray(${targetText});`);
          }
        });
      }
    };
  }
});
