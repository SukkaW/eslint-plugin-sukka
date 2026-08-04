import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

/**
 * Yield fixes that guarantee `import { ...names } from 'source'` exists.
 *
 * - Already imported → yields nothing.
 * - An import from `source` exists → merges the specifier into it.
 * - Otherwise → inserts a fresh import line after the last import
 *   (or before the first statement).
 *
 * Stateless by design: it inspects the AST on every call. Pass every name a
 * single rule needs together so ESLint receives one non-overlapping import fix.
 */
export function *ensureNamedImports(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  source: string,
  names: readonly string[]
): Generator<TSESLint.RuleFix> {
  const uniqueNames = new Set(names);
  if (uniqueNames.size === 0) return;

  const uniqueNamesArr = Array.from(uniqueNames);

  const imports = sourceCode.ast.body.filter((s) => s.type === AST_NODE_TYPES.ImportDeclaration);
  // Short circuit: if the module specifier never appears in the file text,
  // there is nothing to merge with — jump straight to inserting
  const existing = sourceCode.text.includes(source)
    ? imports.find((d) => d.source.value === source)
    : undefined;

  if (existing != null) {
    const specifiers = existing.specifiers.filter((s) => s.type === AST_NODE_TYPES.ImportSpecifier);
    const importedNames = new Set(specifiers.map((s) => s.local.name));
    const missingNames = uniqueNamesArr.filter((name) => !importedNames.has(name));
    if (missingNames.length === 0) return;

    const lastSpecifier = specifiers.at(-1);
    if (lastSpecifier != null) {
      yield fixer.insertTextAfter(lastSpecifier, `, ${missingNames.join(', ')}`);
      return;
    }
  }

  const importText = `import { ${uniqueNamesArr.join(', ')} } from '${source}';\n`;
  const lastImport = imports.at(-1);
  if (lastImport == null) {
    yield fixer.insertTextBefore(sourceCode.ast.body[0], importText);
  } else {
    yield fixer.insertTextAfter(lastImport, '\n' + importText);
  }
}

export function *ensureNamedImport(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  source: string,
  name: string
): Generator<TSESLint.RuleFix> {
  yield *ensureNamedImports(fixer, sourceCode, source, [name]);
}
