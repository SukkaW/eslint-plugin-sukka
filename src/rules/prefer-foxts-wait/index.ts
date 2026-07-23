import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalReference } from '@/utils/ast';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint, ASTUtils } from '@typescript-eslint/utils';

const IMPORT_SOURCE = 'foxts/wait';
const PROMISE_TIMER_SOURCES = new Set(['timers/promises', 'node:timers/promises']);

// The single `setTimeout(resolve, timeout)` call inside a Promise executor whose
// first parameter is `resolve`. Returns the timeout argument, or null.
function getManualDelayTimeout(executor: TSESTree.Node): TSESTree.Expression | null {
  if (!ASTUtils.isFunction(executor)) return null;

  // Only the bare `resolve => …` shape — a `reject` param means the executor
  // does more than a plain delay, so leave it alone.
  if (executor.params.length !== 1) return null;
  const [resolveParam] = executor.params;
  if (resolveParam.type !== AST_NODE_TYPES.Identifier) return null;
  const resolveName = resolveParam.name;

  // Body is either `setTimeout(...)` (arrow expression) or a block with a single
  // `setTimeout(...)` expression statement.
  let call: TSESTree.Expression | undefined;
  if (executor.body.type === AST_NODE_TYPES.CallExpression) {
    call = executor.body;
  } else if (executor.body.type === AST_NODE_TYPES.BlockStatement) {
    if (executor.body.body.length !== 1) return null;
    const [stmt] = executor.body.body;
    if (stmt.type !== AST_NODE_TYPES.ExpressionStatement) return null;
    call = stmt.expression;
  }

  if (call?.type !== AST_NODE_TYPES.CallExpression) return null;

  // Must be a plain global `setTimeout(resolve, timeout)` — exactly the resolve
  // fn and a timeout, nothing forwarded through.
  if (
    call.callee.type !== AST_NODE_TYPES.Identifier
    || call.callee.name !== 'setTimeout'
    || call.arguments.length !== 2
  ) {
    return null;
  }

  const [first, second] = call.arguments;
  if (first.type !== AST_NODE_TYPES.Identifier || first.name !== resolveName) return null;
  if (second.type === AST_NODE_TYPES.SpreadElement) return null;

  return second;
}

export default createRule({
  name: 'prefer-foxts-wait',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hand-rolled `await new Promise(resolve => setTimeout(resolve, ms))` delays and the promisified `timers/promises` `setTimeout(ms)`. Use `wait` from `foxts/wait` instead.'
    },
    fixable: 'code',
    messages: {
      default: 'Prefer `wait` from `foxts/wait` over a hand-rolled promisified delay.'
    },
    schema: []
  },
  create(context) {
    return {
      // new Promise(resolve => setTimeout(resolve, ms))
      NewExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.Identifier
          || node.callee.name !== 'Promise'
          || !isGlobalReference(context.sourceCode, node.callee)
          || node.arguments.length !== 1
        ) {
          return;
        }

        const timeout = getManualDelayTimeout(node.arguments[0]);
        if (timeout == null) return;

        context.report({
          node,
          messageId: 'default',
          *fix(fixer) {
            yield *ensureNamedImport(fixer, context.sourceCode, IMPORT_SOURCE, 'wait');
            yield fixer.replaceText(node, `wait(${context.sourceCode.getText(timeout)})`);
          }
        });
      },

      // setTimeout(ms) imported from timers/promises (local name may be aliased)
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.Identifier
          || node.arguments.length !== 1
          || node.arguments[0].type === AST_NODE_TYPES.SpreadElement
        ) {
          return;
        }

        if (!isPromiseTimerImport(context.sourceCode, node.callee)) return;

        context.report({
          node,
          messageId: 'default',
          *fix(fixer) {
            yield *ensureNamedImport(fixer, context.sourceCode, IMPORT_SOURCE, 'wait');
            yield fixer.replaceText(node.callee, 'wait');
          }
        });
      }
    };
  }
});

// Whether `id` resolves to a `setTimeout` imported from `timers/promises`.
function isPromiseTimerImport(
  sourceCode: TSESLint.SourceCode,
  id: TSESTree.Identifier
): boolean {
  const variable = ASTUtils.findVariable(sourceCode.getScope(id), id.name);
  const def = variable?.defs.at(0);
  if (def?.type !== TSESLint.Scope.DefinitionType.ImportBinding) return false;

  const decl = def.parent;
  if (!('source' in decl)) return false; // exclude import equal
  if (typeof decl.source.value !== 'string' || !PROMISE_TIMER_SOURCES.has(decl.source.value)) return false;

  // import { setTimeout } / import { setTimeout as x } from 'timers/promises'
  return def.node.type === AST_NODE_TYPES.ImportSpecifier
    && def.node.imported.type === AST_NODE_TYPES.Identifier
    && def.node.imported.name === 'setTimeout';
}
