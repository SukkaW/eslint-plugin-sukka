import { createRule, isParserWithTypeInformation } from '@/utils/create-eslint-rule';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { ParserServices } from '@typescript-eslint/utils';
import { TypeFlags as tsTypeFlags } from 'typescript';
import { getBit, setBit } from 'foxts/bitwise';
import { getTypeFromTreeNode, isArrayLikeType } from '../no-for-in-iterable';

const RE_LEADING_WHITESPACE = /^(\s*)/;

function hasSpreadArgument(node: TSESTree.CallExpression): boolean {
  return node.arguments.some((arg) => arg.type === AST_NODE_TYPES.SpreadElement);
}

function isPushCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.MemberExpression
    && !node.callee.computed
    && node.callee.property.type === AST_NODE_TYPES.Identifier
    && node.callee.property.name === 'push';
}

// `appendArrayInPlace` reads `source.length`, so any other iterable silently appends nothing.
// Without a usable type, only the sources that are evidently not arrays are rejected.
function isAppendableSource(node: TSESTree.Expression, services: Partial<ParserServices> | undefined): boolean {
  if (isParserWithTypeInformation(services)) {
    const type = getTypeFromTreeNode(node, services);
    if (!getBit(type.flags, setBit(tsTypeFlags.Any, tsTypeFlags.Unknown))) {
      return isArrayLikeType(type, services);
    }
  }
  return node.type !== AST_NODE_TYPES.NewExpression
    && node.type !== AST_NODE_TYPES.Literal
    && node.type !== AST_NODE_TYPES.TemplateLiteral;
}

// Multiple statements would escape an unbraced body such as `if (x) arr.push(a, ...b);`
function isStatementListParent(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.Program
    || node.type === AST_NODE_TYPES.BlockStatement
    || node.type === AST_NODE_TYPES.StaticBlock
    || node.type === AST_NODE_TYPES.SwitchCase
    || node.type === AST_NODE_TYPES.TSModuleBlock;
}

export default createRule({
  name: 'prefer-foxts-array-utils',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow spread arguments in `Array.prototype.push()`. Use `appendArrayInPlace` from `foxts/append-array-in-place` instead.'
    },
    fixable: 'code',
    messages: {
      noSpreadInPush: 'Do not use spread arguments in `.push()`. Use `appendArrayInPlace` from `foxts/append-array-in-place` instead.'
    },
    schema: []
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    return {
      CallExpression(node) {
        if (!isPushCall(node) || !hasSpreadArgument(node)) return;

        const receiver = context.sourceCode.getText((node.callee as TSESTree.MemberExpression).object);

        // Group arguments into runs:
        // - consecutive non-spread args become one push() call
        // - each spread arg becomes an appendArrayInPlace() call
        const args = node.arguments;
        const segments: string[] = [];
        let nonSpreadBuf: string[] = [];

        const flushNonSpread = () => {
          if (nonSpreadBuf.length > 0) {
            segments.push(`${receiver}.push(${nonSpreadBuf.join(', ')});`);
            nonSpreadBuf = [];
          }
        };

        for (let i = 0, len = args.length; i < len; i++) {
          const arg = args[i];
          if (arg.type === AST_NODE_TYPES.SpreadElement) {
            flushNonSpread();
            const spreadArgText = context.sourceCode.getText(arg.argument);
            segments.push(`appendArrayInPlace(${receiver}, ${spreadArgText});`);
          } else {
            nonSpreadBuf.push(context.sourceCode.getText(arg));
          }
        }
        flushNonSpread();

        // The rewrite is a list of statements, so the value of `push()` must be unused
        const statement = node.parent;
        const fixable = statement.type === AST_NODE_TYPES.ExpressionStatement
          && (segments.length === 1 || isStatementListParent(statement.parent))
          && args.every((arg) => arg.type !== AST_NODE_TYPES.SpreadElement || isAppendableSource(arg.argument, services));

        context.report({
          node,
          messageId: 'noSpreadInPush',
          fix: fixable
            ? function *fix(fixer) {
              yield *ensureNamedImport(fixer, context.sourceCode, 'foxts/append-array-in-place', 'appendArrayInPlace');

              const indent = RE_LEADING_WHITESPACE.exec(context.sourceCode.getText(statement))?.[1] ?? '';
              const replacement = segments.join('\n' + indent);

              yield fixer.replaceText(statement, replacement);
            }
            : null
        });
      }
    };
  }
});
