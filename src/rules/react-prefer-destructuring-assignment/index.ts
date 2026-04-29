import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/utils';

export type MessageId = 'default';

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function isUpperCaseStart(name: string): boolean {
  return name.length > 0 && /^[A-Z]/.test(name);
}

function isLikelyComponent(node: FunctionNode): boolean {
  const parent = node.parent as TSESTree.Node | undefined;

  // FunctionDeclaration with uppercase name, but skip `export default function App`
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    if (node.id == null || !isUpperCaseStart(node.id.name)) return false;
    return parent?.type !== AST_NODE_TYPES.ExportDefaultDeclaration;
  }

  // FunctionExpression with uppercase name: function App(props) {} passed to memo/forwardRef
  if (node.type === AST_NODE_TYPES.FunctionExpression && node.id != null) {
    return isUpperCaseStart(node.id.name);
  }

  // Arrow function assigned to uppercase variable: const App = (props) => {}
  if (parent?.type === AST_NODE_TYPES.VariableDeclarator) {
    const id = (parent as TSESTree.VariableDeclarator).id;
    if (id.type === AST_NODE_TYPES.Identifier) {
      return isUpperCaseStart(id.name);
    }
  }

  return false;
}

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
      if (!isLikelyComponent(node)) return;
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
