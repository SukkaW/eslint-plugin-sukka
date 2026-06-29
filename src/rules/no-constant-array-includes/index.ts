import { createRule } from '@/utils/create-eslint-rule';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';

export default createRule({
  name: 'no-constant-array-includes',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow `.includes()` on constant arrays. Use a `Set` with `.has()` for O(1) lookup instead.'
    },
    messages: {
      default: 'Do not use `.includes()` on a constant array. Use a `Set` with `.has()` instead.'
    },
    schema: []
  },
  create(context) {
    return {
      'CallExpression[callee.type="MemberExpression"][callee.property.name="includes"]': (node: TSESTree.CallExpression) => {
        const callee = node.callee as TSESTree.MemberExpression;
        const staticValue = ASTUtils.getStaticValue(callee.object, context.sourceCode.getScope(callee.object));
        if (staticValue != null && Array.isArray(staticValue.value)) {
          context.report({ node, messageId: 'default' });
        }
      }
    };
  }
});
