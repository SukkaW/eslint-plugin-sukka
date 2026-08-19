import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';
import { createRule } from '@/utils/create-eslint-rule';

/**
 * Wrappers whose sole identifier argument is safe to inline into. Kept to
 * higher-order component / observable factories that take the component as
 * their first argument and return a component: inlining the declaration keeps
 * the function name, so React DevTools still shows `Comp` instead of
 * `Anonymous`.
 */
const DEFAULT_WRAPPERS = [
  'memo',
  'forwardRef',
  'observer',
  'React.memo',
  'React.forwardRef'
] as const;

interface RawOptions {
  wrappers?: readonly string[],
  allowWrapped?: boolean
}

interface Options {
  wrappers: ReadonlySet<string>,
  allowWrapped: boolean
}

const optionSchema: JSONSchema4 = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wrappers: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true
    },
    allowWrapped: {
      type: 'boolean'
    }
  }
};

/** A declaration statement that could be merged into its export. */
interface Declaration {
  /** The statement to prefix with `export ` / splice away. */
  statement: TSESTree.ProgramStatement,
  name: string,
  /** The identifier node defining the binding, for scope lookups. */
  id: TSESTree.Identifier,
  /** Set for function/class declarations; absent for `const x = ...`. */
  isFunctionOrClass: boolean
}

function getDeclaration(statement: TSESTree.ProgramStatement): Declaration | null {
  if (
    statement.type === AST_NODE_TYPES.FunctionDeclaration
    || statement.type === AST_NODE_TYPES.ClassDeclaration
  ) {
    // `export default function () {}` has no id; a declaration statement
    // without one is not valid standalone anyway.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `id` is nullable in a `export default` context despite the declaration type
    if (statement.id == null) return null;
    // Generators are skipped: inlining is textually safe, but `function*`
    // renaming/hoisting semantics differ enough that we stay out of it.
    if (statement.type === AST_NODE_TYPES.FunctionDeclaration && statement.generator) return null;
    if (statement.declare) return null;

    return {
      statement,
      name: statement.id.name,
      id: statement.id,
      isFunctionOrClass: true
    };
  }

  if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    if (statement.declare) return null;
    // Multiple declarators cannot be split, and only `const` is safe to move
    // after the point of use (`let`/`var` may be reassigned in between).
    if (statement.declarations.length !== 1) return null;
    if (statement.kind !== 'const') return null;

    const [declarator] = statement.declarations;
    if (declarator.id.type !== AST_NODE_TYPES.Identifier) return null;
    if (declarator.init == null) return null;

    return {
      statement,
      name: declarator.id.name,
      id: declarator.id,
      isFunctionOrClass: false
    };
  }

  return null;
}

function getVariable(
  sourceCode: TSESLint.SourceCode,
  declaration: Declaration
): TSESLint.Scope.Variable | null {
  return ASTUtils.findVariable(sourceCode.getScope(declaration.id), declaration.name);
}

/**
 * `true` when the binding is written to anywhere after initialisation. Such a
 * binding cannot be inlined: `export default function Comp() {}` exports the
 * value at declaration time, whereas `export default Comp` exports whatever
 * `Comp` holds when the module finishes evaluating.
 */
function isReassigned(variable: TSESLint.Scope.Variable | null): boolean {
  return variable?.references.some((reference) => !reference.init && reference.isWrite()) ?? false;
}

/**
 * `true` when the binding is read anywhere other than `allowedReference`.
 * Inlining removes the standalone binding, so any other use would break.
 */
function hasOtherReferences(
  variable: TSESLint.Scope.Variable | null,
  allowedReference: TSESTree.Identifier
): boolean {
  return variable?.references.some(
    (reference) => !reference.init && reference.identifier !== allowedReference
  ) ?? false;
}

/**
 * `true` when the binding is exported by some specifier other than
 * `specifier`. Inlining keeps the binding, so other *reads* are harmless, but
 * a second `export { Comp }` would turn into a duplicate export.
 *
 * Note: in the shorthand `export { Comp }`, `local` and `exported` are the
 * same node, so the reference must be matched against the specifier rather
 * than against `specifier.local` alone.
 */
function isExportedMoreThanOnce(
  variable: TSESLint.Scope.Variable | null,
  specifier: TSESTree.ExportSpecifier
): boolean {
  return variable?.references.some((reference) => {
    const { parent } = reference.identifier;
    return parent.type === AST_NODE_TYPES.ExportSpecifier && parent !== specifier;
  }) ?? false;
}

function getWrapperName(callee: TSESTree.Node, sourceCode: TSESLint.SourceCode): string | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
  if (
    callee.type === AST_NODE_TYPES.MemberExpression
    && !callee.computed
    && callee.object.type === AST_NODE_TYPES.Identifier
    && callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return sourceCode.getText(callee);
  }
  return null;
}

/**
 * `true` when the declaration is the implementation of a TypeScript overload
 * set. Adding `export` to only the implementation is a TS error ("Overload
 * signatures must all be exported or non-exported"), and the preceding
 * signatures would be left behind, so those are skipped entirely.
 */
function isOverloadImplementation(
  variable: TSESLint.Scope.Variable | null,
  declaration: Declaration
): boolean {
  return variable?.defs.some(
    (def) => def.node !== declaration.statement
      && def.node.type === AST_NODE_TYPES.TSDeclareFunction
  ) ?? false;
}

/**
 * Comments between the declaration and its export would be stranded in the
 * middle of the merged statement, so we report without fixing.
 */
function hasCommentsBetween(
  sourceCode: TSESLint.SourceCode,
  left: TSESTree.Node,
  right: TSESTree.Node
): boolean {
  return sourceCode.getCommentsBefore(right).some(
    (comment) => comment.range[0] >= left.range[1]
  );
}

export default createRule({
  name: 'prefer-inline-export',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer declaring exports inline instead of declaring a binding and exporting it separately.',
      recommended: 'stylistic'
    },
    fixable: 'code',
    messages: {
      inlineDefault: 'Prefer declaring this default-exported {{kind}} inline: `export default {{kind}} {{name}}`.',
      inlineNamed: 'Prefer exporting `{{name}}` inline instead of a separate `export {{{name}}}` statement.',
      inlineWrapped: 'Prefer declaring `{{name}}` inline inside `{{wrapper}}()` so the function keeps its name.'
    },
    schema: [optionSchema]
  },
  resolveOptions(raw?: RawOptions | null): Options {
    return {
      wrappers: new Set(raw?.wrappers ?? DEFAULT_WRAPPERS),
      allowWrapped: raw?.allowWrapped ?? true
    };
  },
  create(context, options) {
    const { sourceCode } = context;

    return {
      Program(program) {
        const { body } = program;

        for (let i = 0, len = body.length; i < len; i++) {
          const statement = body[i];
          const declaration = getDeclaration(statement);
          if (declaration == null) continue;

          // Only merge with an export that directly follows the declaration.
          // Anything in between (including other statements) is left alone, so
          // hoisting/TDZ ordering cannot change.
          const next = body[i + 1] as TSESTree.ProgramStatement | undefined;
          if (next == null) continue;

          const variable = getVariable(sourceCode, declaration);
          if (isReassigned(variable)) continue;
          if (isOverloadImplementation(variable, declaration)) continue;

          if (next.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
            const exported = next.declaration;

            // Case 1: `export default Comp`
            if (
              exported.type === AST_NODE_TYPES.Identifier
              && exported.name === declaration.name
            ) {
              // A `const` holding a non-function/class cannot become
              // `export default const`, so only inline declarations.
              if (!declaration.isFunctionOrClass) continue;
              if (hasOtherReferences(variable, exported)) continue;

              const kind = statement.type === AST_NODE_TYPES.ClassDeclaration ? 'class' : 'function';
              const fixable = !hasCommentsBetween(sourceCode, statement, next);

              context.report({
                node: next,
                messageId: 'inlineDefault',
                data: { kind, name: declaration.name },
                fix: fixable
                  ? (fixer) => [
                    fixer.insertTextBefore(statement, 'export default '),
                    fixer.removeRange([statement.range[1], next.range[1]])
                  ]
                  : null
              });
              continue;
            }

            // Case 2: `export default memo(Comp)`
            if (
              options.allowWrapped
              && exported.type === AST_NODE_TYPES.CallExpression
              && declaration.isFunctionOrClass
              && statement.type === AST_NODE_TYPES.FunctionDeclaration
            ) {
              const wrapper = getWrapperName(exported.callee, sourceCode);
              if (wrapper == null || !options.wrappers.has(wrapper)) continue;

              const [first] = exported.arguments as Array<TSESTree.CallExpressionArgument | undefined>;
              if (first?.type !== AST_NODE_TYPES.Identifier || first.name !== declaration.name) continue;
              if (hasOtherReferences(variable, first)) continue;
              if (hasCommentsBetween(sourceCode, statement, next)) continue;

              const declarationText = sourceCode.getText(statement);

              context.report({
                node: next,
                messageId: 'inlineWrapped',
                data: { name: declaration.name, wrapper },
                fix: (fixer) => [
                  // Drop the declaration statement (and the gap up to the
                  // export) then substitute it for the identifier argument.
                  fixer.removeRange([statement.range[0], next.range[0]]),
                  fixer.replaceText(first, declarationText)
                ]
              });
            }
            continue;
          }

          // Case 3: `export { Comp }`
          if (
            next.type === AST_NODE_TYPES.ExportNamedDeclaration
            && next.declaration == null
            && next.source == null
            && next.exportKind === 'value'
            && next.specifiers.length === 1
          ) {
            const [specifier] = next.specifiers;
            if (specifier.exportKind === 'type') continue;
            if (specifier.local.name !== declaration.name) continue;
            // `export { Comp as default }` / `as Other` renames cannot be
            // expressed as an inline declaration, and `export { Comp as "a-b" }`
            // uses a string name that is not a valid binding at all.
            if (specifier.exported.type !== AST_NODE_TYPES.Identifier) continue;
            if (specifier.exported.name !== declaration.name) continue;
            // The binding stays after inlining, so other *reads* are fine —
            // but a second `export { Comp }` would become a duplicate export.
            if (isExportedMoreThanOnce(variable, specifier)) continue;

            const fixable = !hasCommentsBetween(sourceCode, statement, next);

            context.report({
              node: next,
              messageId: 'inlineNamed',
              data: { name: declaration.name },
              fix: fixable
                ? (fixer) => [
                  fixer.insertTextBefore(statement, 'export '),
                  fixer.removeRange([statement.range[1], next.range[1]])
                ]
                : null
            });
          }
        }
      }
    };
  }
});
