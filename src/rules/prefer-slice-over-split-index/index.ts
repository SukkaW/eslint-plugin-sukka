import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

function staticValue(
  node: TSESTree.Node,
  sourceCode: Readonly<TSESLint.SourceCode>
): unknown {
  return ASTUtils.getStaticValue(node, sourceCode.getScope(node))?.value;
}

function isSupportedLimit(
  limit: TSESTree.CallExpressionArgument | undefined,
  index: 0 | 1,
  sourceCode: Readonly<TSESLint.SourceCode>
): boolean {
  if (limit == null) return true;
  const value = staticValue(limit, sourceCode);
  return typeof value === 'number' && Number.isSafeInteger(value) && value > index;
}

function getSplitCall(
  node: TSESTree.MemberExpression,
  sourceCode: Readonly<TSESLint.SourceCode>
): TSESTree.CallExpression | null {
  const call = node.object;
  if (call.type !== AST_NODE_TYPES.CallExpression) return null;
  const callee = call.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  if (ASTUtils.getPropertyName(callee, sourceCode.getScope(callee)) !== 'split') return null;
  if (call.arguments.length === 0 || call.arguments.length > 2) return null;
  const separator = call.arguments[0];
  const value = staticValue(separator, sourceCode);
  if (typeof value !== 'string' || value.length === 0) return null;
  return call;
}

export default createRule({
  name: 'prefer-slice-over-split-index',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `indexOf(needle)` and `slice(...)` over `split()[N]` when splitting a string into two pieces.'
    },
    messages: {
      preferSliceFirst: 'Prefer `indexOf(needle)` and `slice(0, index)` over `split(needle)[0]` for string separators. `split` will allocate an intermediate array, resulting in poorer performance. Preserve the missing-separator fallback explicitly.',
      preferSliceSecond: 'Prefer `indexOf(needle)` and `slice(index)` over `split(needle)[1]` for string separators. `split` will allocate an intermediate array, resulting in poorer performance. Preserve the missing-separator fallback explicitly.'
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    return {
      MemberExpression(node) {
        if (!node.computed) return;
        const index = staticValue(node.property, sourceCode);
        if (index !== 0 && index !== 1) return;

        const call = getSplitCall(node, sourceCode);
        if (call == null || !isSupportedLimit(call.arguments[1], index, sourceCode)) return;

        context.report({
          node,
          messageId: index === 0 ? 'preferSliceFirst' : 'preferSliceSecond'
        });
      }
    };
  }
});
