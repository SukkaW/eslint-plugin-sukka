import { createRule } from '@/utils/create-eslint-rule';
import { isComponentName } from '@/utils/react-hooks';
import type { FunctionNode } from '@/utils/react-hooks';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

const JSX_RETURN_TYPE_NAMES = new Set([
  'ReactNode',
  'ReactElement',
  'JSX.Element',
  'Element'
]);

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

  // memo(function Comp(...)) / forwardRef(function Comp(...))
  if (
    parent.type === AST_NODE_TYPES.CallExpression
    && parent.arguments[0] === node
  ) {
    return getWrapperComponentName(parent);
  }

  // export default function(props: ...) {} / export default (props: ...) => {}
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

function getPropsTypeMembers(
  node: FunctionNode,
  typeMap: Map<string, TSESTree.TSPropertySignature[]>
): TSESTree.TSPropertySignature[] | null {
  const [propsParam] = node.params;
  if (propsParam == null) return null;

  let typeAnnotation: TSESTree.TypeNode | null = null;

  if ((
    propsParam.type === AST_NODE_TYPES.Identifier
    || propsParam.type === AST_NODE_TYPES.ObjectPattern
  ) && propsParam.typeAnnotation != null) {
    typeAnnotation = propsParam.typeAnnotation.typeAnnotation;
  }

  if (typeAnnotation == null) return null;

  return resolveTypeMembers(typeAnnotation, typeMap);
}

function resolveTypeMembers(
  typeNode: TSESTree.TypeNode,
  typeMap: Map<string, TSESTree.TSPropertySignature[]>
): TSESTree.TSPropertySignature[] | null {
  if (typeNode.type === AST_NODE_TYPES.TSTypeLiteral) {
    return typeNode.members.filter(
      (m): m is TSESTree.TSPropertySignature => m.type === AST_NODE_TYPES.TSPropertySignature
    );
  }

  if (typeNode.type === AST_NODE_TYPES.TSTypeReference && typeNode.typeName.type === AST_NODE_TYPES.Identifier) {
    return typeMap.get(typeNode.typeName.name) ?? null;
  }

  if (typeNode.type === AST_NODE_TYPES.TSIntersectionType) {
    const allMembers: TSESTree.TSPropertySignature[] = [];
    for (const member of typeNode.types) {
      const resolved = resolveTypeMembers(member, typeMap);
      if (resolved != null) {
        appendArrayInPlace(allMembers, resolved);
      }
    }
    return allMembers.length > 0 ? allMembers : null;
  }

  return null;
}

function getReturnTypeName(node: TSESTree.TypeNode): string | null {
  if (
    node.type === AST_NODE_TYPES.TSTypeReference
    && node.typeName.type === AST_NODE_TYPES.TSQualifiedName
    && node.typeName.left.type === AST_NODE_TYPES.Identifier
    && node.typeName.left.name === 'React'
  ) {
    return node.typeName.right.name;
  }

  if (node.type === AST_NODE_TYPES.TSTypeReference && node.typeName.type === AST_NODE_TYPES.Identifier) {
    return node.typeName.name;
  }

  if (
    node.type === AST_NODE_TYPES.TSTypeReference
    && node.typeName.type === AST_NODE_TYPES.TSQualifiedName
    && node.typeName.left.type === AST_NODE_TYPES.Identifier
    && node.typeName.left.name === 'JSX'
    && node.typeName.right.name === 'Element'
  ) {
    return 'JSX.Element';
  }

  return null;
}

function isJsxReturnType(node: TSESTree.TypeNode): boolean {
  const name = getReturnTypeName(node);
  if (name != null && JSX_RETURN_TYPE_NAMES.has(name)) return true;

  if (node.type === AST_NODE_TYPES.TSUnionType) {
    return node.types.some((t) => {
      const n = getReturnTypeName(t);
      return n != null && JSX_RETURN_TYPE_NAMES.has(n);
    });
  }

  return false;
}

function isFunctionTypeReturningJsx(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === AST_NODE_TYPES.TSFunctionType && typeNode.returnType != null) {
    return isJsxReturnType(typeNode.returnType.typeAnnotation);
  }

  if (typeNode.type === AST_NODE_TYPES.TSUnionType) {
    return typeNode.types.some((t) => isFunctionTypeReturningJsx(t));
  }

  return false;
}

function getPropName(node: TSESTree.TSPropertySignature): string | null {
  if (node.key.type === AST_NODE_TYPES.Identifier) return node.key.name;
  if (node.key.type === AST_NODE_TYPES.Literal && typeof node.key.value === 'string') return node.key.value;
  return null;
}

function collectTypeMembers(node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral): TSESTree.TSPropertySignature[] {
  const members = node.type === AST_NODE_TYPES.TSTypeLiteral ? node.members : node.body;
  return members.filter(
    (m): m is TSESTree.TSPropertySignature => m.type === AST_NODE_TYPES.TSPropertySignature
  );
}

export default createRule({
  name: 'react-no-render-function-prop',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow declaring React component props that accept render functions returning JSX. Prefer hooks and direct rendering.'
    },
    messages: {
      default: 'Do not declare prop "{{name}}" as a render function returning JSX. Expose data via hooks and let consumers render JSX directly.'
    },
    schema: []
  },
  create(context) {
    const typeMap = new Map<string, TSESTree.TSPropertySignature[]>();

    function checkComponent(node: FunctionNode) {
      const name = getComponentName(node);
      if (name == null) return;

      const members = getPropsTypeMembers(node, typeMap);
      if (members == null) return;

      for (const member of members) {
        if (member.typeAnnotation == null) continue;
        if (!isFunctionTypeReturningJsx(member.typeAnnotation.typeAnnotation)) continue;

        const propName = getPropName(member);
        if (propName == null) continue;

        context.report({
          node: member,
          messageId: 'default',
          data: { name: propName }
        });
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        typeMap.set(node.id.name, collectTypeMembers(node.body));
      },
      TSTypeAliasDeclaration(node) {
        const resolved = resolveTypeMembers(node.typeAnnotation, typeMap);
        if (resolved != null) {
          typeMap.set(node.id.name, resolved);
        }
      },
      FunctionDeclaration: checkComponent,
      FunctionExpression: checkComponent,
      ArrowFunctionExpression: checkComponent
    };
  }
});
