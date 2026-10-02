import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';
import { walkNodes } from './ast';

/** Resolve exports by binding so aliases, forward exports, and shadowing agree. */
export function collectEnumExports(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program
): Map<TSESTree.TSEnumDeclaration, TSESTree.Node> {
  const exports = new Map<TSESTree.TSEnumDeclaration, TSESTree.Node>();

  function addIdentifier(id: TSESTree.Identifier, exportNode: TSESTree.Node): void {
    const variable = ASTUtils.findVariable(sourceCode.getScope(id), id);
    if (variable == null) return;
    for (let i = 0, len = variable.defs.length; i < len; i++) {
      const def = variable.defs[i];
      if (def.node.type === AST_NODE_TYPES.TSEnumDeclaration && !exports.has(def.node)) {
        exports.set(def.node, exportNode);
      }
    }
  }

  walkNodes(program, sourceCode.visitorKeys, (node) => {
    if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
      // A re-export names a binding in another module, not a local enum.
      if (node.source != null) return;

      const declaration = node.declaration;
      if (declaration?.type === AST_NODE_TYPES.TSEnumDeclaration) {
        exports.set(declaration, node);
      } else if (declaration?.type === AST_NODE_TYPES.VariableDeclaration) {
        for (let i = 0, len = declaration.declarations.length; i < len; i++) {
          const declarator = declaration.declarations[i];
          if (declarator.id.type === AST_NODE_TYPES.Identifier) {
            addIdentifier(declarator.id, node);
          }
        }
      }

      // Type-only exports still expose the enum in generated declarations.
      for (let i = 0, len = node.specifiers.length; i < len; i++) {
        const specifier = node.specifiers[i];
        addIdentifier(specifier.local, node);
      }
    } else if (
      node.type === AST_NODE_TYPES.ExportDefaultDeclaration
      && node.declaration.type === AST_NODE_TYPES.Identifier
    ) {
      addIdentifier(node.declaration, node);
    } else if (
      node.type === AST_NODE_TYPES.TSExportAssignment
      && node.expression.type === AST_NODE_TYPES.Identifier
    ) {
      addIdentifier(node.expression, node);
    }
  });

  return exports;
}
