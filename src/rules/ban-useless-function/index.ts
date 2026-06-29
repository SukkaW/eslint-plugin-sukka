import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint, ASTUtils } from '@typescript-eslint/utils';
import type { FunctionNode } from '@/utils/react-hooks';
import { getAllScopeRefs } from '@/utils/react-hooks';

// Functions whose purpose is explicitly to create fresh objects
const FACTORY_PATTERNS = [/^create[A-Z]/, /[Ff]actory$/, /^make[A-Z]/, /^build[A-Z]/, /^init[A-Z]/];

function isFactoryName(name: string): boolean {
  return FACTORY_PATTERNS.some((re) => re.test(name));
}

// Global constructors that produce mutable objects
const MUTABLE_CONSTRUCTORS = new Set([
  'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float16Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
  'FormData', 'URLSearchParams', 'Headers',
  'RegExp', 'Date', 'Error', 'URL'
]);

function isFreshMutableExpression(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.ObjectExpression) return true;
  if (node.type === AST_NODE_TYPES.ArrayExpression) return true;
  if (node.type === AST_NODE_TYPES.NewExpression) {
    if (node.callee.type === AST_NODE_TYPES.Identifier) {
      return MUTABLE_CONSTRUCTORS.has(node.callee.name);
    }
    return true;
  }
  return false;
}

function returnsFreshMutableObject(node: FunctionNode): boolean {
  if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return isFreshMutableExpression(node.body);
  }

  for (const stmt of node.body.body) {
    if (
      stmt.type === AST_NODE_TYPES.ReturnStatement
      && stmt.argument != null
      && isFreshMutableExpression(stmt.argument)
    ) {
      return true;
    }
  }
  return false;
}

function getFunctionName(node: FunctionNode): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id != null) {
    return node.id.name;
  }
  const parent = node.parent;
  if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
    return parent.id.name;
  }
  if (
    parent.type === AST_NODE_TYPES.Property
    && !parent.computed
    && parent.value === node
    && parent.key.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.key.name;
  }
  return null;
}

function isMutableBinding(variable: TSESLint.Scope.Variable): boolean {
  for (const def of variable.defs) {
    // Function parameter — changes per invocation
    if (def.type === TSESLint.Scope.DefinitionType.Parameter) return true;
    if (def.type !== TSESLint.Scope.DefinitionType.Variable) continue;
    const kind = def.node.parent.kind;
    if (kind === 'let' || kind === 'var') return true;
  }
  return false;
}

function isConstMutatedObject(variable: TSESLint.Scope.Variable): boolean {
  for (const def of variable.defs) {
    if (def.type !== TSESLint.Scope.DefinitionType.Variable) continue;
    if (def.node.parent.kind !== 'const') continue;
    if (def.node.init == null || !isFreshMutableExpression(def.node.init)) continue;

    // Exported mutable object can be mutated by any importing module
    const declaration = def.node.parent;
    if (declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return true;

    // const binding to mutable object — check if any reference mutates it
    for (const ref of variable.references) {
      const id = ref.identifier;
      const parent = id.parent;

      // export { arr } — named export elsewhere in the file
      if (parent.type === AST_NODE_TYPES.ExportSpecifier) return true;

      if (parent.type !== AST_NODE_TYPES.MemberExpression || parent.object !== id) continue;

      const grandparent = parent.parent;
      // arr[i] = x, obj.key = x
      if (grandparent.type === AST_NODE_TYPES.AssignmentExpression && grandparent.left === parent) return true;
      // delete obj.key
      if (grandparent.type === AST_NODE_TYPES.UnaryExpression && grandparent.operator === 'delete') return true;
      // arr.push(), obj.method() — any method call on the object is potentially mutating
      if (grandparent.type === AST_NODE_TYPES.CallExpression && grandparent.callee === parent) return true;
    }
  }
  return false;
}

export default createRule({
  name: 'ban-useless-function',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ban functions with no parameters whose result is fully pre-determinable. Call the function once and reuse the result instead.'
    },
    messages: {
      default: 'This function has no parameters and all its external references are pre-determinable. Call it once and reuse the result, or inline the body.'
    },
    schema: []
  },
  create(context) {
    return {
      ':function': (node: FunctionNode) => {
        if (node.params.length > 0) return;
        if (node.async || node.generator) return;

        const { parent } = node;

        // Object property/method value — likely a callback or API contract
        if (
          parent.type === AST_NODE_TYPES.Property
          || parent.type === AST_NODE_TYPES.MethodDefinition
        ) return;

        // Callback passed as argument — invoked by external code
        if (parent.type === AST_NODE_TYPES.CallExpression) return;

        const name = getFunctionName(node);
        if (name != null && isFactoryName(name) && returnsFreshMutableObject(node)) return;

        // Exported functions may be called from outside with different expectations
        if (node.type === AST_NODE_TYPES.FunctionDeclaration && (
          parent.type === AST_NODE_TYPES.ExportNamedDeclaration
          || parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
        )) {
          return;
        }

        const funcScope = context.sourceCode.getScope(node).childScopes.find((s) => s.block === node)
          ?? context.sourceCode.getScope(node.body);
        if (funcScope == null) return;

        for (const ref of getAllScopeRefs(funcScope)) {
          if (ref.isWrite()) continue;

          const variable = ASTUtils.findVariable(funcScope, ref.identifier.name);
          if (variable == null) continue;

          // Defined inside the function itself — always fine
          if (variable.scope === funcScope) continue;
          if (funcScope.childScopes.some((s) => s === variable.scope)) continue;

          // Mutable binding — function result depends on when it's called
          if (isMutableBinding(variable)) return;

          // const binding to a mutable object that is mutated elsewhere
          if (isConstMutatedObject(variable)) return;

          // Immutable binding whose value can't be statically resolved (e.g. import, function, class, enum) — still pre-determinable
        }

        let reportNode: typeof node | typeof node.parent = node;
        if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
          reportNode = node.id ?? node;
        } else if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) {
          reportNode = node.parent.id;
        }

        context.report({ node: reportNode, messageId: 'default' });
      }
    };
  }
});
