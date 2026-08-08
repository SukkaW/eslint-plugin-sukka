import { createRule } from '@/utils/create-eslint-rule';
import { ensureNamedImports } from '@/utils/ensure-import';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint, ASTUtils } from '@typescript-eslint/utils';

const IMPORT_SOURCE = 'foxts/split-nth';
const MAX_ARRAY_INDEX = 0xFF_FF_FF_FE;

type HelperName = 'split0th' | 'split1st' | 'prefer_splitNth';
type MessageId = 'prefer_split0th' | 'prefer_split1st' | 'preferprefer_splitNth';

interface SplitCall {
  call: TSESTree.CallExpression,
  separatorValue: string
}

interface Candidate extends SplitCall {
  node: TSESTree.MemberExpression,
  index: number,
  helperName: HelperName,
  messageId: MessageId
}

function staticValue(
  node: TSESTree.Node,
  sourceCode: Readonly<TSESLint.SourceCode>
): unknown {
  return ASTUtils.getStaticValue(node, sourceCode.getScope(node))?.value;
}

function isSupportedLimit(
  limit: TSESTree.CallExpressionArgument | undefined,
  index: number,
  sourceCode: Readonly<TSESLint.SourceCode>
): boolean {
  if (limit == null) return true;
  const value = staticValue(limit, sourceCode);
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && (value >>> 0) > index;
}

function getSplitCall(
  node: TSESTree.MemberExpression,
  sourceCode: Readonly<TSESLint.SourceCode>
): SplitCall | null {
  const call = node.object;
  if (call.type !== AST_NODE_TYPES.CallExpression) return null;
  const callee = call.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  if (ASTUtils.getPropertyName(callee, sourceCode.getScope(callee)) !== 'split') return null;
  if (call.arguments.length === 0 || call.arguments.length > 2) return null;
  const separatorValue = staticValue(call.arguments[0], sourceCode);
  return typeof separatorValue === 'string' ? { call, separatorValue } : null;
}

function getHelper(index: number, separatorValue: string): {
  helperName: HelperName,
  messageId: MessageId
} {
  // The specialized helpers intentionally optimize non-empty separators.
  // `prefer_splitNth` is the only one that preserves `split('')` UTF-16 code-unit behavior.
  if (separatorValue !== '') {
    if (index === 0) {
      return { helperName: 'split0th', messageId: 'prefer_split0th' };
    }
    if (index === 1) {
      return { helperName: 'split1st', messageId: 'prefer_split1st' };
    }
  }
  return { helperName: 'prefer_splitNth', messageId: 'preferprefer_splitNth' };
}

function canUseHelper(
  node: TSESTree.Node,
  helperName: HelperName,
  sourceCode: Readonly<TSESLint.SourceCode>
): boolean {
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), helperName);
  if (variable == null || variable.defs.length === 0) return true;

  const def = variable.defs.at(0);
  return def?.type === TSESLint.Scope.DefinitionType.ImportBinding
    && def.node.type === AST_NODE_TYPES.ImportSpecifier
    && def.node.imported.type === AST_NODE_TYPES.Identifier
    && def.node.imported.name === helperName
    && 'source' in def.parent
    && def.parent.source.value === IMPORT_SOURCE;
}

function getReplacement(
  candidate: Candidate,
  sourceCode: Readonly<TSESLint.SourceCode>
): string | null {
  const { node, index, call, helperName } = candidate;
  const callee = call.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return null;

  const separator = call.arguments[0];
  const limit = call.arguments.at(1);
  if (
    separator.type === AST_NODE_TYPES.SpreadElement
    || callee.object.type === AST_NODE_TYPES.Super
    || call.optional
    || callee.optional
    || ASTUtils.hasSideEffect(node.property, sourceCode)
    || (callee.computed && ASTUtils.hasSideEffect(callee.property, sourceCode))
    || (limit != null && ASTUtils.hasSideEffect(limit, sourceCode))
    || sourceCode.getCommentsInside(node).length > 0
    || !canUseHelper(node, helperName, sourceCode)
  ) return null;

  const argumentsText = [
    sourceCode.getText(callee.object),
    sourceCode.getText(separator)
  ];
  if (helperName === 'prefer_splitNth') argumentsText.push(String(index));
  return `${helperName}(${argumentsText.join(', ')})`;
}

export default createRule({
  name: 'prefer-slice-over-split-index',
  meta: {
    type: 'suggestion',
    docs: {
      recommended: 'recommended',
      description: 'Prefer the optimized helpers from `foxts/split-nth` over allocating an intermediate array with `value.split(separator)[index]`.'
    },
    fixable: 'code',
    messages: {
      prefer_split0th: 'Use `split0th(value, separator)` from `foxts/split-nth` to avoid allocating an intermediate array.',
      prefer_split1st: 'Use `split1st(value, separator)` from `foxts/split-nth` to avoid allocating an intermediate array.',
      preferprefer_splitNth: 'Use `prefer_splitNth(value, separator, index)` from `foxts/split-nth` to avoid allocating an intermediate array.'
    },
    schema: []
  },
  create(context) {
    const { sourceCode } = context;
    const candidates: Candidate[] = [];

    return {
      MemberExpression(node) {
        if (!node.computed) return;
        const index = staticValue(node.property, sourceCode);
        if (
          typeof index !== 'number'
          || !Number.isSafeInteger(index)
          || index < 0
          || index > MAX_ARRAY_INDEX
        ) return;

        const match = getSplitCall(node, sourceCode);
        if (
          match == null
          || !isSupportedLimit(match.call.arguments[1], index, sourceCode)
        ) return;

        candidates.push({
          node,
          index,
          ...match,
          ...getHelper(index, match.separatorValue)
        });
      },

      'Program:exit': () => {
        const replacements = candidates.map((candidate) => getReplacement(candidate, sourceCode));
        const importedHelpers = candidates.flatMap((candidate, index) => (
          replacements[index] == null ? [] : [candidate.helperName]
        ));
        let importFixClaimed = false;

        candidates.forEach((candidate, index) => {
          const replacement = replacements[index];
          let fix: TSESLint.ReportFixFunction | null = null;
          if (replacement != null) {
            const ensureImport = !importFixClaimed;
            importFixClaimed = true;
            fix = function *fix(fixer) {
              if (ensureImport) {
                yield *ensureNamedImports(
                  fixer,
                  sourceCode,
                  IMPORT_SOURCE,
                  importedHelpers
                );
              }
              yield fixer.replaceText(candidate.node, replacement);
            };
          }

          context.report({
            node: candidate.node,
            messageId: candidate.messageId,
            fix
          });
        });
      }
    };
  }
});
