import { createRule } from '@/utils/create-eslint-rule';

export type MessageId = 'noDuplicateProps';

export default createRule({
  name: 'jsx-no-duplicate-props',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow duplicate JSX props.'
    },
    messages: {
      noDuplicateProps: 'Prop `{{propName}}` is specified more than once. Only the last one will take effect.'
    },
    schema: []
  },
  create(context) {
    function getPropName(
      attribute: { name: { type: string, namespace?: { name: string }, name: string | { name: string } } }
    ): string {
      if (attribute.name.type === 'JSXNamespacedName') {
        const ns = attribute.name.namespace as { name: string };
        const local = attribute.name.name as { name: string };
        return `${ns.name}:${local.name}`;
      }
      return attribute.name.name as string;
    }

    return {
      JSXOpeningElement(node) {
        const seen = new Map<string, boolean>();
        for (const attribute of node.attributes) {
          if (attribute.type === 'JSXSpreadAttribute') continue;
          const propName = getPropName(attribute);
          if (seen.has(propName)) {
            context.report({
              node: attribute,
              messageId: 'noDuplicateProps',
              data: { propName }
            });
          }
          seen.set(propName, true);
        }
      }
    };
  }
});
