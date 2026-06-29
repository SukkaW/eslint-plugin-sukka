import { createRule } from '@/utils/create-eslint-rule';
import { getComponentName } from '@/utils/react-hooks';
import type { FunctionNode } from '@/utils/react-hooks';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

export type MessageId = 'default';

export default createRule({
  name: 'react-prefer-destructuring-assignment',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce the use of destructuring assignment for component props.'
    },
    messages: {
      default: 'Use destructuring assignment for component props.'
    },
    schema: []
  },
  create(context) {
    const components: FunctionNode[] = [];

    function collectComponent(node: FunctionNode) {
      const name = getComponentName(node);
      if (name == null || name === 'default') return;
      // Skip `export default function App` — props.foo is acceptable there
      if (node.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) return;
      const [props] = node.params;
      if (props?.type !== AST_NODE_TYPES.Identifier) return;
      components.push(node);
    }

    return {
      FunctionDeclaration: collectComponent,
      FunctionExpression: collectComponent,
      ArrowFunctionExpression: collectComponent,
      'Program:exit': function () {
        for (const node of components) {
          const [props] = node.params as [TSESTree.Identifier, ...TSESTree.Parameter[]];
          const propName = props.name;
          const propVariable = context.sourceCode
            .getScope(node)
            .variables
            .find((v) => v.name === propName);
          const propReferences = propVariable?.references ?? [];

          for (const ref of propReferences) {
            const { parent } = ref.identifier;
            if (parent.type !== AST_NODE_TYPES.MemberExpression) continue;
            context.report({ messageId: 'default', node: parent });
          }
        }
      }
    };
  }
});
