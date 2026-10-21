import { createRule } from '@/utils/create-eslint-rule';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';

// lucide-react exports every icon as `Globe`, `GlobeIcon` and `LucideGlobe`,
// alongside these non-icon exports
const LUCIDE_NON_ICON_EXPORTS = new Set([
  'Icon',
  'LucideProvider',
  'createLucideIcon',
  'icons',
  'useLucideContext',
  'IconNode',
  'LucideIcon',
  'LucideIconData',
  'LucideIconNode',
  'LucideProps',
  'SVGAttributes'
]);

// import source → the preferred export name of an imported icon, or null when
// the import is not an icon or already uses the preferred name
const ICON_LIBRARIES = new Map<string, (name: string) => string | null>([
  ['lucide-react', (name) => {
    if (LUCIDE_NON_ICON_EXPORTS.has(name) || name.endsWith('Icon')) return null;
    return (name.startsWith('Lucide') ? name.slice(6) : name) + 'Icon';
  }]
]);

interface PendingRename {
  specifier: TSESTree.ImportSpecifier,
  variable: TSESLint.Scope.Variable,
  name: string,
  preferred: string,
  source: string
}

export default createRule({
  name: 'react-icon-import-naming',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce consistent names for icons imported from React icon libraries (e.g. `GlobeIcon` over `Globe` from `lucide-react`) for readability and to avoid name collisions.'
    },
    fixable: 'code',
    messages: {
      default: 'Import `{{preferred}}` instead of `{{name}}` from `{{source}}`.'
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    const pendingRenames: PendingRename[] = [];
    const jsxTags: TSESTree.JSXOpeningElement[] = [];

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;

        const source = node.source.value;
        const getPreferredName = ICON_LIBRARIES.get(source);
        if (getPreferredName == null) return;

        for (let i = 0, len = node.specifiers.length; i < len; i++) {
          const specifier = node.specifiers[i];
          if (specifier.type !== AST_NODE_TYPES.ImportSpecifier || specifier.importKind === 'type') continue;

          const name = getModuleExportName(specifier.imported);
          const preferred = getPreferredName(name);
          if (preferred == null) continue;

          // `{ Globe as Earth }` keeps its local binding, only the imported name changes
          if (specifier.local.name !== name) {
            const { local, imported } = specifier;
            context.report({
              node: specifier,
              messageId: 'default',
              data: { name, preferred, source },
              fix: (fixer) => (local.name === preferred
                ? fixer.replaceText(specifier, preferred)
                : fixer.replaceText(imported, preferred))
            });
            continue;
          }

          const variable = sourceCode.getDeclaredVariables(specifier).at(0);
          if (variable == null) continue;

          // Renaming the binding has to cover every JSX tag, which are only all
          // collected once the traversal finishes
          pendingRenames.push({ specifier, variable, name, preferred, source });
        }
      },
      JSXOpeningElement(node) {
        jsxTags.push(node);
      },
      'Program:exit': () => {
        for (let i = 0, len = pendingRenames.length; i < len; i++) {
          const { specifier, variable, name, preferred, source } = pendingRenames[i];

          // JSX tags are resolved here instead of taken from `variable.references`,
          // since ESLint 9 does not track JSX references for espree-parsed code
          const references = variable.references.filter((ref) => ref.identifier.type !== AST_NODE_TYPES.JSXIdentifier);
          const tags = jsxTags.filter((tag) => tag.name.type === AST_NODE_TYPES.JSXIdentifier
            && tag.name.name === name
            && ASTUtils.findVariable(sourceCode.getScope(tag), name) === variable);

          // `preferred` must not already be declared, nor be shadowed or used as
          // a global anywhere the binding is used
          const canRename = !variable.scope.set.has(preferred)
            && !variable.scope.through.some((ref) => ref.identifier.name === preferred)
            && references.every((ref) => ASTUtils.findVariable(ref.from, preferred) == null)
            && tags.every((tag) => ASTUtils.findVariable(sourceCode.getScope(tag), preferred) == null);

          context.report({
            node: specifier,
            messageId: 'default',
            data: { name, preferred, source },
            fix: canRename
              ? function *(fixer) {
                yield fixer.replaceText(specifier, preferred);

                for (let j = 0, refLen = references.length; j < refLen; j++) {
                  yield renameReference(fixer, references[j].identifier, name, preferred);
                }

                for (let j = 0, tagLen = tags.length; j < tagLen; j++) {
                  const tag = tags[j];
                  yield fixer.replaceText(tag.name, preferred);
                  if (tag.parent.closingElement) {
                    yield fixer.replaceText(tag.parent.closingElement.name, preferred);
                  }
                }
              }
              : null
          });
        }
      }
    };
  }
});

function getModuleExportName(node: TSESTree.Identifier | TSESTree.StringLiteral): string {
  return node.type === AST_NODE_TYPES.Identifier ? node.name : node.value;
}

function renameReference(
  fixer: TSESLint.RuleFixer,
  id: TSESTree.Identifier | TSESTree.JSXIdentifier,
  name: string,
  preferred: string
): TSESLint.RuleFix {
  const { parent } = id;

  // `{ Globe }` → `{ Globe: GlobeIcon }`
  if (parent.type === AST_NODE_TYPES.Property && parent.shorthand) {
    return fixer.replaceText(parent, `${name}: ${preferred}`);
  }

  // `export { Globe }` → `export { GlobeIcon as Globe }`, the module keeps its export name
  if (parent.type === AST_NODE_TYPES.ExportSpecifier && getModuleExportName(parent.exported) === name) {
    return fixer.replaceText(parent, `${preferred} as ${name}`);
  }

  return fixer.replaceText(id, preferred);
}
