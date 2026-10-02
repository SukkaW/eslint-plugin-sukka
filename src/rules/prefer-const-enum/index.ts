import { createRule } from '@/utils/create-eslint-rule';
import { collectEnumExports } from '@/utils/enum';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

type Constant = string | number;

const RE_DECLARATION_FILE = /\.d\.[cm]?ts$/;

function getMemberName(node: TSESTree.TSEnumMember): string {
  return node.id.type === AST_NODE_TYPES.Identifier ? node.id.name : node.id.value;
}

function getAccessName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) return node.property.name;
  if (node.computed && node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return undefined;
}

function evaluateBinary(operator: TSESTree.BinaryExpression['operator'], left: Constant, right: Constant): Constant | undefined {
  if (operator === '+') {
    return typeof left === 'string' || typeof right === 'string' ? `${left}${right}` : left + right;
  }
  if (typeof left !== 'number' || typeof right !== 'number') return undefined;
  switch (operator) {
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '**': return left ** right;
    case '<<': return left << right;
    case '>>': return left >> right;
    case '>>>': return left >>> right;
    case '&': return left & right;
    // eslint-disable-next-line sukka/prefer-foxts-bitwise -- Match TypeScript's constant-expression evaluation.
    case '|': return left | right;
    case '^': return left ^ right;
    default: return undefined;
  }
}

/** Evaluate only constant enum expressions, without requiring typed linting. */
function createEnumEvaluator(sourceCode: TSESLint.SourceCode) {
  const enums = new Map<TSESTree.TSEnumDeclaration, Map<string, Constant> | null>();
  const evaluating = new Set<TSESTree.Expression>();

  function evaluate(node: TSESTree.Expression): Constant | undefined {
    if (evaluating.has(node)) return undefined;
    evaluating.add(node);
    const value = evaluateExpression(node);
    evaluating.delete(node);
    return typeof value === 'number' && !Number.isFinite(value) ? undefined : value;
  }

  function evaluateExpression(node: TSESTree.Expression): Constant | undefined {
    if (node.type === AST_NODE_TYPES.Literal) {
      return typeof node.value === 'number' || typeof node.value === 'string' ? node.value : undefined;
    }
    if (node.type === AST_NODE_TYPES.TemplateLiteral) {
      let value = node.quasis[0].value.cooked;
      if (value == null) return undefined;
      for (let i = 0, len = node.expressions.length; i < len; i++) {
        const expression = node.expressions[i];
        const part = evaluate(expression);
        const suffix = node.quasis[i + 1].value.cooked;
        if (part == null || suffix == null) return undefined;
        value += `${part}${suffix}`;
      }
      return value;
    }
    if (node.type === AST_NODE_TYPES.UnaryExpression) {
      const value = evaluate(node.argument);
      if (typeof value !== 'number') return undefined;
      switch (node.operator) {
        case '+': return value;
        case '-': return -value;
        case '~': return ~value;
        default: return undefined;
      }
    }
    if (node.type === AST_NODE_TYPES.BinaryExpression) {
      if (node.left.type === AST_NODE_TYPES.PrivateIdentifier) return undefined;
      const left = evaluate(node.left);
      const right = evaluate(node.right);
      return left == null || right == null ? undefined : evaluateBinary(node.operator, left, right);
    }
    if (node.type === AST_NODE_TYPES.Identifier) {
      const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
      if (variable?.defs.length !== 1) return undefined;
      const declaration = variable.defs[0].node;
      if (declaration.range[0] >= node.range[0]) return undefined;
      if (declaration.type === AST_NODE_TYPES.TSEnumMember) {
        const enumNode = declaration.parent.parent;
        return getValues(enumNode)?.get(getMemberName(declaration));
      }
      if (
        declaration.type === AST_NODE_TYPES.VariableDeclarator
        && declaration.parent.kind === 'const'
        && declaration.id.type === AST_NODE_TYPES.Identifier
        && declaration.id.typeAnnotation == null
        && declaration.init != null
      ) {
        return evaluate(declaration.init);
      }
    }
    if (
      node.type === AST_NODE_TYPES.MemberExpression
      && !node.optional
      && node.object.type === AST_NODE_TYPES.Identifier
    ) {
      const name = getAccessName(node);
      if (name == null) return undefined;
      const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.object);
      if (variable?.defs.length !== 1) return undefined;
      const declaration = variable.defs[0].node;
      if (declaration.type === AST_NODE_TYPES.TSEnumDeclaration && declaration.range[0] < node.range[0]) {
        return getValues(declaration)?.get(name);
      }
    }
    return undefined;
  }

  function getValues(node: TSESTree.TSEnumDeclaration): Map<string, Constant> | null {
    if (enums.has(node)) return enums.get(node)!;
    if (node.declare) return null;
    const values = new Map<string, Constant>();
    // Make earlier members available while evaluating subsequent initializers.
    enums.set(node, values);
    let previous: Constant = -1;
    for (let i = 0, len = node.body.members.length; i < len; i++) {
      const member = node.body.members[i];
      const value: Constant | undefined = member.initializer == null
        ? (typeof previous === 'number' ? previous + 1 : undefined)
        : evaluate(member.initializer);
      if (value == null || (typeof value === 'number' && !Number.isFinite(value))) {
        enums.set(node, null);
        return null;
      }
      values.set(getMemberName(member), value);
      previous = value;
    }
    return values;
  }

  return getValues;
}

function hasSafeReferences(variable: TSESLint.Scope.Variable, members: Map<string, Constant>): boolean {
  return variable.references.every((reference) => {
    const id = reference.identifier;
    if (reference.isTypeReference || id.parent.type === AST_NODE_TYPES.TSTypeQuery) return true;
    const access = id.parent;
    if (
      access.type !== AST_NODE_TYPES.MemberExpression
      || access.object !== id
      || access.optional
    ) return false;

    const name = getAccessName(access);
    if (name == null || !members.has(name)) return false;
    const parent = access.parent;
    return (parent.type !== AST_NODE_TYPES.AssignmentExpression || parent.left !== access)
      && parent.type !== AST_NODE_TYPES.UpdateExpression
      && (parent.type !== AST_NODE_TYPES.UnaryExpression || parent.operator !== 'delete');
  });
}

export default createRule({
  name: 'prefer-const-enum',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require module-local enums with constant members to either use const enum or convert them to a normal object.'
    },
    fixable: 'code',
    messages: {
      preferConstEnum: 'Use `const enum` for an enum local to this module.',
      enumObjectUsage: 'Avoid using the enum as a runtime object, you should either access its members directly (along with const enum) or convert it to a normal object.'
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    const candidates: TSESTree.TSEnumDeclaration[] = [];
    const getValues = createEnumEvaluator(sourceCode);

    return {
      TSEnumDeclaration(node) {
        if (node.const || node.declare) return;
        // Namespaces and global/ambient declarations need broader visibility
        // and declaration-merging analysis than a file-local rule provides.
        if (sourceCode.getAncestors(node).some((ancestor) => ancestor.type === AST_NODE_TYPES.TSModuleDeclaration)) return;
        candidates.push(node);
      },
      'Program:exit': function (program) {
        if (candidates.length === 0 || program.sourceType !== 'module' || RE_DECLARATION_FILE.test(context.filename)) return;
        const exports = collectEnumExports(sourceCode, program);

        for (let i = 0, len = candidates.length; i < len; i++) {
          const node = candidates[i];
          if (exports.has(node)) continue;
          const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.id);
          // Changing one declaration in a merged binding would be invalid.
          if (variable?.defs.length !== 1) continue;
          const members = getValues(node);
          if (members == null) continue;
          const safe = hasSafeReferences(variable, members);

          context.report({
            node: node.id,
            messageId: safe ? 'preferConstEnum' : 'enumObjectUsage',
            fix: safe ? (fixer) => fixer.insertTextBefore(node, 'const ') : undefined
          });
        }
      }
    };
  }
});
