import { createRule } from '@/utils/create-eslint-rule';
import { isComponentName } from '@/utils/react-hooks';
import type { FunctionNode } from '@/utils/react-hooks';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';

function getComponentName(node: FunctionNode): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id != null) {
    return isComponentName(node.id.name) ? node.id.name : null;
  }

  if (node.type === AST_NODE_TYPES.FunctionExpression && node.id != null && isComponentName(node.id.name)) {
    return node.id.name;
  }

  const parent = node.parent;
  if (!parent) return null;

  if (
    parent.type === AST_NODE_TYPES.VariableDeclarator
    && parent.id.type === AST_NODE_TYPES.Identifier
    && isComponentName(parent.id.name)
  ) {
    return parent.id.name;
  }

  if (
    parent.type === AST_NODE_TYPES.CallExpression
    && parent.arguments[0] === node
  ) {
    return getWrapperComponentName(parent);
  }

  if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return 'default';
  }

  return null;
}

function getWrapperComponentName(callExpr: TSESTree.CallExpression): string | null {
  const { callee } = callExpr;

  const isMemoOrForwardRef =
    (callee.type === AST_NODE_TYPES.Identifier && (callee.name === 'memo' || callee.name === 'forwardRef'))
    || (callee.type === AST_NODE_TYPES.MemberExpression
      && callee.object.type === AST_NODE_TYPES.Identifier
      && callee.object.name === 'React'
      && callee.property.type === AST_NODE_TYPES.Identifier
      && (callee.property.name === 'memo' || callee.property.name === 'forwardRef'));

  if (!isMemoOrForwardRef) return null;

  const parent = callExpr.parent;
  if (
    parent.type === AST_NODE_TYPES.VariableDeclarator
    && parent.id.type === AST_NODE_TYPES.Identifier
    && isComponentName(parent.id.name)
  ) {
    return parent.id.name;
  }

  if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return 'default';
  }

  return null;
}

function isReactNodeType(node: TSESTree.TypeNode): boolean {
  if (node.type === AST_NODE_TYPES.TSTypeReference) {
    if (node.typeName.type === AST_NODE_TYPES.Identifier && node.typeName.name === 'ReactNode') {
      return true;
    }
    if (
      node.typeName.type === AST_NODE_TYPES.TSQualifiedName
      && node.typeName.left.type === AST_NODE_TYPES.Identifier
      && node.typeName.left.name === 'React'
      && node.typeName.right.name === 'ReactNode'
    ) {
      return true;
    }
  }
  return false;
}

function isChildrenOnlyTypeLiteral(node: TSESTree.TSTypeLiteral): boolean {
  const props = node.members.filter(
    (m): m is TSESTree.TSPropertySignature => m.type === AST_NODE_TYPES.TSPropertySignature
  );
  if (props.length !== 1) return false;

  const prop = props[0];
  if (prop.key.type !== AST_NODE_TYPES.Identifier || prop.key.name !== 'children') return false;
  if (prop.typeAnnotation == null) return false;

  return isReactNodeType(prop.typeAnnotation.typeAnnotation);
}

export default createRule({
  name: 'react-prefer-props-with-children',
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Prefer `React.PropsWithChildren` over manually declaring `{ children: ReactNode }`.'
    },
    messages: {
      default: 'Use `React.PropsWithChildren` instead of manually declaring `{ children: ReactNode }`.'
    },
    schema: []
  },
  create(context) {
    const typeMap = new Map<string, { node: TSESTree.TSTypeLiteral, typeDeclNode: TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration }>();

    function checkComponent(node: FunctionNode) {
      const name = getComponentName(node);
      if (name == null) return;

      const [propsParam] = node.params;
      if (propsParam == null) return;

      let typeAnnotation: TSESTree.TypeNode | null = null;
      if (
        (propsParam.type === AST_NODE_TYPES.Identifier || propsParam.type === AST_NODE_TYPES.ObjectPattern)
        && propsParam.typeAnnotation != null
      ) {
        typeAnnotation = propsParam.typeAnnotation.typeAnnotation;
      }
      if (typeAnnotation == null) return;

      // Inline type literal: (props: { children: ReactNode })
      if (typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral) {
        if (isChildrenOnlyTypeLiteral(typeAnnotation)) {
          context.report({
            node: typeAnnotation,
            messageId: 'default',
            fix(fixer) {
              return fixer.replaceText(typeAnnotation, 'React.PropsWithChildren');
            }
          });
        }
        return;
      }

      // Readonly<{ children: ReactNode }>
      if (
        typeAnnotation.type === AST_NODE_TYPES.TSTypeReference
        && typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier
        && typeAnnotation.typeName.name === 'Readonly'
        && typeAnnotation.typeArguments?.params.length === 1
        && typeAnnotation.typeArguments.params[0].type === AST_NODE_TYPES.TSTypeLiteral
        && isChildrenOnlyTypeLiteral(typeAnnotation.typeArguments.params[0])
      ) {
        context.report({
          node: typeAnnotation,
          messageId: 'default',
          fix(fixer) {
            return fixer.replaceText(typeAnnotation, 'React.PropsWithChildren');
          }
        });
        return;
      }

      // Referenced type: (props: MyProps)
      if (typeAnnotation.type === AST_NODE_TYPES.TSTypeReference && typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier) {
        const entry = typeMap.get(typeAnnotation.typeName.name);
        if (entry != null && isChildrenOnlyTypeLiteral(entry.node)) {
          context.report({
            node: entry.typeDeclNode,
            messageId: 'default'
          });
        }
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        if (node.body.body.length > 0) {
          const syntheticLiteral = {
            type: AST_NODE_TYPES.TSTypeLiteral,
            members: node.body.body
          } as TSESTree.TSTypeLiteral;
          typeMap.set(node.id.name, { node: syntheticLiteral, typeDeclNode: node });
        }
      },
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral) {
          typeMap.set(node.id.name, { node: node.typeAnnotation, typeDeclNode: node });
        }
      },
      FunctionDeclaration: checkComponent,
      FunctionExpression: checkComponent,
      ArrowFunctionExpression: checkComponent
    };
  }
});
