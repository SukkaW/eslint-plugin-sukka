import { createRule } from '@/utils/create-eslint-rule';
import type { TSESTree } from '@typescript-eslint/types';

export type MessageId = 'preferShorthandFragment';

export default createRule({
  name: 'jsx-shorthand-fragment',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce shorthand fragment syntax.'
    },
    fixable: 'code',
    messages: {
      preferShorthandFragment: "Use shorthand fragment syntax '<>...</>' instead of '<{{pattern}}>...</{{pattern}}>'.'"
    },
    schema: []
  },
  create(context) {
    function reportSyntaxPreferred(node: TSESTree.JSXOpeningElement, pattern: string) {
      if (node.attributes.length > 0) return;
      context.report({
        node,
        messageId: 'preferShorthandFragment',
        data: { pattern },
        fix(fixer) {
          const closing = (node.parent as TSESTree.JSXElement | undefined)?.closingElement;
          if (!closing) return null;
          return [fixer.replaceText(node, '<>'), fixer.replaceText(closing, '</>')];
        }
      });
    }

    return {
      JSXOpeningElement(node) {
        const { name } = node;
        if (name.type === 'JSXIdentifier' && name.name === 'Fragment') {
          reportSyntaxPreferred(node, 'Fragment');
          return;
        }
        if (name.type !== 'JSXMemberExpression') return;
        if (name.object.type !== 'JSXIdentifier' || name.object.name !== 'React') return;
        if (name.property.type !== 'JSXIdentifier' || name.property.name !== 'Fragment') return;
        reportSyntaxPreferred(node, 'React.Fragment');
      }
    };
  }
});
