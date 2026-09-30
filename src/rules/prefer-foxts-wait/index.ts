import { createRule } from '@/utils/create-eslint-rule';
import { isGlobalReference } from '@/utils/ast';
import { ensureNamedImport } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

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
      default: 'Prefer `wait` from `foxts/wait` over a hand-rolled promisified delay.',
      timersPromises: 'Prefer `wait` from `foxts/wait` over `setTimeout` from `{{source}}` as a delay.'
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

      // import { setTimeout as delay } from 'timers/promises'; await delay(ms);
      ImportDeclaration(node) {
        if (
          node.importKind === 'type'
          || typeof node.source.value !== 'string'
          || !PROMISE_TIMER_SOURCES.has(node.source.value)
        ) {
          return;
        }

        const source = node.source.value;

        for (let i = 0, len = node.specifiers.length; i < len; i++) {
          const specifier = node.specifiers[i];
          if (
            specifier.type !== AST_NODE_TYPES.ImportSpecifier
            || specifier.importKind === 'type'
            || getImportedName(specifier) !== 'setTimeout'
          ) {
            continue;
          }

          const variable = context.sourceCode.getDeclaredVariables(specifier).at(0);
          if (variable == null) continue;

          const delayCalls: TSESTree.CallExpression[] = [];
          let onlyDelayCalls = true;
          for (let j = 0, refLen = variable.references.length; j < refLen; j++) {
            const call = getDelayCall(variable.references[j].identifier);
            if (call == null) {
              onlyDelayCalls = false;
            } else {
              delayCalls.push(call);
            }
          }

          if (delayCalls.length === 0) continue;

          if (onlyDelayCalls) {
            // Every use is a bare delay — swap the import itself over to `foxts/wait`
            context.report({
              node: specifier,
              messageId: 'timersPromises',
              data: { source },
              fix: (fixer) => fixTimersImport(fixer, context.sourceCode, node, specifier, variable)
            });
            continue;
          }

          // The binding is also used as the real `setTimeout(ms, value)`, so the
          // import has to stay — only rewrite the bare delay call sites.
          for (let j = 0, callLen = delayCalls.length; j < callLen; j++) {
            const call = delayCalls[j];
            context.report({
              node: call,
              messageId: 'timersPromises',
              data: { source },
              *fix(fixer) {
                yield *ensureNamedImport(fixer, context.sourceCode, IMPORT_SOURCE, 'wait');
                yield fixer.replaceText(call.callee, 'wait');
              }
            });
          }
        }
      }
    };
  }
});

function getImportedName(specifier: TSESTree.ImportSpecifier): string {
  return specifier.imported.type === AST_NODE_TYPES.Identifier
    ? specifier.imported.name
    : specifier.imported.value;
}

// `id(ms)` — exactly one non-spread argument, so nothing beyond the delay
// (resolved value, `{ signal }`, …) is forwarded.
function getDelayCall(id: TSESTree.Identifier | TSESTree.JSXIdentifier): TSESTree.CallExpression | null {
  const call = id.parent;
  if (
    call.type !== AST_NODE_TYPES.CallExpression
    || call.callee !== id
    || call.arguments.length !== 1
    || call.arguments[0].type === AST_NODE_TYPES.SpreadElement
  ) {
    return null;
  }
  return call;
}

function *fixTimersImport(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  decl: TSESTree.ImportDeclaration,
  specifier: TSESTree.ImportSpecifier,
  variable: TSESLint.Scope.Variable
): Generator<TSESLint.RuleFix> {
  let localName = specifier.local.name;

  // `wait as setTimeout` would read like the real timer, so rename the call
  // sites to `wait` (or an existing `foxts/wait` import) when that is safe.
  if (localName === 'setTimeout') {
    const existing = findWaitImport(sourceCode);
    const target = existing?.name ?? 'wait';

    if (canRenameReferences(variable, target, existing)) {
      for (let i = 0, len = variable.references.length; i < len; i++) {
        const ref = variable.references[i];
        yield fixer.replaceText(ref.identifier, target);
      }
      if (existing != null) {
        yield removeImportSpecifier(fixer, sourceCode, decl, specifier);
        return;
      }
      localName = target;
    }
  }

  const specifierText = localName === 'wait' ? 'wait' : `wait as ${localName}`;
  const quote = decl.source.raw[0];
  const sourceText = quote + IMPORT_SOURCE + quote;

  if (decl.specifiers.length === 1) {
    // Sole specifier: retarget the declaration in place
    yield fixer.replaceText(specifier, specifierText);
    yield fixer.replaceText(decl.source, sourceText);
    return;
  }

  // Sibling specifiers still need `timers/promises`, move ours to a new import
  const semi = ASTUtils.isSemicolonToken(sourceCode.getLastToken(decl)!) ? ';' : '';
  yield removeImportSpecifier(fixer, sourceCode, decl, specifier);
  yield fixer.insertTextAfter(decl, `\nimport { ${specifierText} } from ${sourceText}${semi}`);
}

// The variable of an existing `import { wait } from 'foxts/wait'`, if any.
function findWaitImport(sourceCode: TSESLint.SourceCode): TSESLint.Scope.Variable | null {
  for (let i = 0, len = sourceCode.ast.body.length; i < len; i++) {
    const stmt = sourceCode.ast.body[i];
    if (
      stmt.type !== AST_NODE_TYPES.ImportDeclaration
      || stmt.importKind === 'type'
      || stmt.source.value !== IMPORT_SOURCE
    ) {
      continue;
    }

    for (let j = 0, specLen = stmt.specifiers.length; j < specLen; j++) {
      const specifier = stmt.specifiers[j];
      if (
        specifier.type === AST_NODE_TYPES.ImportSpecifier
        && specifier.importKind !== 'type'
        && getImportedName(specifier) === 'wait'
      ) {
        return sourceCode.getDeclaredVariables(specifier).at(0) ?? null;
      }
    }
  }
  return null;
}

// Every reference can be renamed to `name` and still resolve to `target`
// (or, when `target` is null, to a new module-level `name` that shadows nothing
// and captures no other reference).
function canRenameReferences(
  variable: TSESLint.Scope.Variable,
  name: string,
  target: TSESLint.Scope.Variable | null
): boolean {
  for (let i = 0, len = variable.references.length; i < len; i++) {
    const ref = variable.references[i];
    if (ASTUtils.findVariable(ref.from, name) !== target) return false;
  }
  return !variable.scope.through.some((ref) => ref.identifier.name === name);
}

function removeImportSpecifier(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  decl: TSESTree.ImportDeclaration,
  specifier: TSESTree.ImportSpecifier
): TSESLint.RuleFix {
  // Sole specifier: drop the whole declaration, along with its line break
  if (decl.specifiers.length === 1) {
    const { text } = sourceCode;
    let end = decl.range[1];
    if (text.startsWith('\r\n', end)) {
      end += 2;
    } else if (text[end] === '\n') {
      end++;
    }
    return fixer.removeRange([decl.range[0], end]);
  }

  // `import d, { setTimeout } from '…'` → `import d from '…'`
  if (decl.specifiers.filter((s) => s.type === AST_NODE_TYPES.ImportSpecifier).length === 1) {
    const comma = sourceCode.getTokenAfter(decl.specifiers[0])!;
    const closingBrace = sourceCode.getTokenAfter(specifier, { filter: ASTUtils.isClosingBraceToken })!;
    return fixer.removeRange([comma.range[0], closingBrace.range[1]]);
  }

  // `{ setTimeout, a }` → `{ a }`
  const after = sourceCode.getTokenAfter(specifier)!;
  if (ASTUtils.isCommaToken(after)) {
    return fixer.removeRange([specifier.range[0], sourceCode.getTokenAfter(after)!.range[0]]);
  }

  // `{ a, setTimeout }` → `{ a }`
  const before = sourceCode.getTokenBefore(specifier)!;
  return fixer.removeRange([before.range[0], specifier.range[1]]);
}
