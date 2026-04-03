import { createRule } from '@/utils/create-eslint-rule';

export type MessageId = 'noMixingControlledAndUncontrolled';

const CONTROLLED_PAIRS: [controlled: string, uncontrolled: string][] = [
  ['value', 'defaultValue'],
  ['checked', 'defaultChecked']
];

export default createRule({
  name: 'react-no-mixing-controlled-and-uncontrolled-props',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow mixing controlled and uncontrolled props on the same element.'
    },
    messages: {
      noMixingControlledAndUncontrolled: "'{{controlled}}' and '{{uncontrolled}}' should not be used together. Use either controlled or uncontrolled mode, not both."
    },
    schema: []
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const props = new Set<string>();
        for (const attr of node.attributes) {
          if (attr.type === 'JSXSpreadAttribute') continue;
          if (attr.name.type === 'JSXNamespacedName') continue;
          props.add(attr.name.name);
        }
        for (const [controlled, uncontrolled] of CONTROLLED_PAIRS) {
          if (!props.has(controlled) || !props.has(uncontrolled)) continue;
          const attrNode = node.attributes.find(
            (a) =>
              a.type === 'JSXAttribute'
              && a.name.type !== 'JSXNamespacedName'
              && a.name.name === uncontrolled
          )!;
          context.report({
            node: attrNode,
            messageId: 'noMixingControlledAndUncontrolled',
            data: { controlled, uncontrolled }
          });
        }
      }
    };
  }
});
