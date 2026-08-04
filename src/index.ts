import type { ESLint, Linter, Rule } from 'eslint';

// eslint-plugin-vibe-proof, the single source of truth for the rules that used
// to live here. They are vendored in under the `sukka/` prefix so existing
// configs keep working without registering a second plugin.
import { eslint_plugin_vibe_proof } from 'eslint-plugin-vibe-proof';

/**
 * Rules this plugin vendors in under a name that differs from vibe-proof's,
 * kept for backwards compatibility. Keyed by the vibe-proof name.
 */
const vibe_proof_renamed_rules: Record<string, string> = {
  'prefer-hoisted-regex': 'no-regex-in-function'
};

function renameVibeProofRule(name: string) {
  return vibe_proof_renamed_rules[name] ?? name;
}

/** Vendor vibe-proof's rules in, applying {@link vibe_proof_renamed_rules}. */
function loadVibeProof(rules: typeof eslint_plugin_vibe_proof.rules) {
  return Object.entries(rules).reduce<Record<string, Rule.RuleModule>>(
    (loaded, [name, rule]) => {
      // @ts-expect-error -- merge rules
      loaded[renameVibeProofRule(name)] = rule;
      return loaded;
    },
    {}
  );
}

/**
 * Re-prefix a vibe-proof preset's rules from `vibe-proof/` to `sukka/`, so its
 * presets can be merged into this plugin's own. New rules added to the upstream
 * preset are picked up automatically, hence reading the preset instead of
 * listing rules by hand.
 */
function loadVibeProofConfig(rules: Linter.RulesRecord): Linter.RulesRecord {
  return Object.entries(rules).reduce<Linter.RulesRecord>(
    (loaded, [key, value]) => {
      loaded[`sukka/${renameVibeProofRule(key.slice('vibe-proof/'.length))}`] = value;
      return loaded;
    },
    {}
  );
}

// eslint-plugin-sukka
import no_return_await from './rules/no-return-await';
import no_expression_empty_lines from './rules/no-expression-empty-lines';
import object_format from './rules/object-format';
import prefer_single_boolean_return from './rules/prefer-single-boolean-return';
import noDuplicatedBranches from './rules/no-duplicated-branches';
import commaOrLogicalOrCase from './rules/comma-or-logical-or-case';
import noElementOverwrite from './rules/no-element-overwrite';
import classPrototype from './rules/class-prototype';
import boolParamDefault from './rules/bool-param-default';
import callArgumentLine from './rules/call-argument-line';
import trackTodoFixmeComment from './rules/track-todo-fixme-comment';
import noEmptyCollection from './rules/no-empty-collection';
import noEqualsInForTermination from './rules/no-equals-in-for-termination';
import noTopLevelThis from './rules/no-top-level-this';
import noInvariantReturns from './rules/no-invariant-returns';
import noRedundantAssignments from './rules/no-redundant-assignments';
import noSameLineConditional from './rules/no-same-line-conditional';
import noSmallSwitch from './rules/no-small-switch';
import noUnusedCollection from './rules/no-unused-collection';
import noUselessPlusplus from './rules/no-useless-plusplus';

import no_export_const_enum from './rules/no-export-const-enum';
import noForInIterable from './rules/no-for-in-iterable';
import onlyAwaitThenable from './rules/only-await-thenable';
import noUndefinedOptionalParameters from './rules/no-undefined-optional-parameters';
import noTryPromise from './rules/no-try-promise';
import noUnthrownError from './rules/no-unthrown-error';
import noUselessStringOperation from './rules/no-useless-string-operation';
import reactFilenameExtension from './rules/react-filename-extension';
import jsxShorthandBoolean from './rules/jsx-shorthand-boolean';
import jsxShorthandFragment from './rules/jsx-shorthand-fragment';
import reactPreferDestructuringAssignment from './rules/react-prefer-destructuring-assignment';
import noArrayFromLengthSpread from './rules/no-array-from-length-spread';
import preferFoxtsNoop from './rules/prefer-foxts-noop';
import preferNullthrow from './rules/prefer-nullthrow';
import preferFoxtsErrorUtil from './rules/prefer-foxts-error-util';
import preferFoxtsArrayUtils from './rules/prefer-foxts-array-utils';
import avoidStringStartsWithSingleChar from './rules/avoid-string-starts-with-single-char';
import reactNoUseStateObject from './rules/react-no-use-state-object';
import noObjectCreateNonNull from './rules/no-object-create-non-null';
import preferFoxtsObjectSize from './rules/prefer-foxts-object-size';
import preferFoxtsCastArray from './rules/prefer-foxts-cast-array';
import preferFoxtsBitwise from './rules/prefer-foxts-bitwise';
import preferFoxtsWait from './rules/prefer-foxts-wait';
import preferSliceOverSplitIndex from './rules/prefer-slice-over-split-index';

const plugin: ESLint.Plugin = {
  configs: {
    recommended: {
      name: 'eslint-plugin-sukka/recommended',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: Object.assign<Linter.RulesRecord, Linter.RulesRecord, Linter.RulesRecord>({
        'sukka/bool-param-default': 'error',
        'sukka/call-argument-line': 'error',
        'sukka/class-prototype': 'warn',
        'sukka/comma-or-logical-or-case': 'error',
        'sukka/no-all-duplicated-branches': 'error',
        'sukka/no-array-from-length-spread': 'error',
        'sukka/no-duplicated-branches': 'error',
        'sukka/no-element-overwrite': 'warn',
        'sukka/no-empty-collection': 'warn',
        'sukka/no-equals-in-for-termination': 'error',
        'sukka/no-export-const-enum': 'error', // not tree-shakable by swc/babel/esbuild
        'sukka/no-expression-empty-lines': 'error',
        'sukka/no-invariant-returns': 'error',
        'sukka/no-redundant-assignments': 'warn',

        // disallow redundant `return await`
        'no-return-await': 'off',
        'sukka/no-return-await': 'error',

        'sukka/no-same-line-conditional': 'error',
        'sukka/no-small-switch': 'error',
        'sukka/no-top-level-this': 'error',
        'sukka/no-unthrown-error': 'warn',
        'sukka/no-unused-collection': 'error',

        'sukka/no-useless-plusplus': 'error',

        'sukka/object-format': 'off', // do not enable by default

        'sukka/prefer-single-boolean-return': 'error',
        'sukka/prefer-foxts-noop': 'error',
        'sukka/prefer-nullthrow': 'error',
        'sukka/prefer-foxts-error-util': 'error',
        'sukka/prefer-foxts-array-utils': 'error',
        'sukka/prefer-foxts-object-size': 'error',
        'sukka/prefer-foxts-cast-array': 'error',
        'sukka/prefer-foxts-bitwise': 'error',
        'sukka/prefer-foxts-wait': 'error',

        'sukka/prefer-slice-over-split-index': 'error',
        'sukka/avoid-string-starts-with-single-char': 'error',
        'sukka/no-object-create-non-null': 'warn',
        'sukka/track-todo-fixme-comment': 'warn'
      },
      loadVibeProofConfig(eslint_plugin_vibe_proof.configs.common.rules),
      {
        // vibe-proof relies on this rule's default option, be explicit here
        'sukka/ban-eslint-disable': ['error', 'allow-with-description']
      })
    },
    recommended_extra_with_typed_lint: {
      name: 'eslint-plugin-sukka/recommended_extra_with_typed_lint',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: Object.assign<Linter.RulesRecord, Linter.RulesRecord, Linter.RulesRecord>(
        {
          'sukka/no-for-in-iterable': 'error',
          'sukka/no-indexof-equality': 'error',
          'sukka/no-try-promise': 'error',
          'sukka/no-undefined-optional-parameters': 'warn',
          'sukka/no-useless-string-operation': 'warn',
          'sukka/only-await-thenable': 'off' // replaced by typescript-eslint await-thenable rule
        },
        loadVibeProofConfig(eslint_plugin_vibe_proof.configs.common_type_checked.rules),
        loadVibeProofConfig(eslint_plugin_vibe_proof.configs.react_type_checked.rules)
      )
    },
    recommended_react: {
      name: 'eslint-plugin-sukka/recommended_react',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: Object.assign<Linter.RulesRecord, Linter.RulesRecord>(
        {
          'sukka/react-filename-extension': ['error', { allow: 'as-needed' }],
          'sukka/jsx-shorthand-boolean': 'error',
          'sukka/jsx-shorthand-fragment': 'error',
          'sukka/react-prefer-destructuring-assignment': 'warn',
          'sukka/react-no-use-state-object': 'warn'
        },
        loadVibeProofConfig(eslint_plugin_vibe_proof.configs.react.rules)
      )
    }
  },
  rules: Object.assign(
    // vendored from eslint-plugin-vibe-proof, see `loadVibeProof`
    loadVibeProof(eslint_plugin_vibe_proof.rules),
    {
      'no-return-await': no_return_await,
      'no-expression-empty-lines': no_expression_empty_lines,
      'object-format': object_format,
      'prefer-single-boolean-return': prefer_single_boolean_return,
      'prefer-foxts-noop': preferFoxtsNoop,
      'prefer-nullthrow': preferNullthrow,
      'no-all-duplicated-branches': noDuplicatedBranches,
      'no-duplicated-branches': noDuplicatedBranches,
      'bool-param-default': boolParamDefault,
      'call-argument-line': callArgumentLine,
      'class-prototype': classPrototype,
      'comma-or-logical-or-case': commaOrLogicalOrCase,
      'track-todo-fixme-comment': trackTodoFixmeComment,
      'no-element-overwrite': noElementOverwrite,
      'no-empty-collection': noEmptyCollection,
      'no-equals-in-for-termination': noEqualsInForTermination,
      'no-top-level-this': noTopLevelThis,
      'no-invariant-returns': noInvariantReturns,
      'no-redundant-assignments': noRedundantAssignments,
      'no-same-line-conditional': noSameLineConditional,
      'no-small-switch': noSmallSwitch,
      'no-unused-collection': noUnusedCollection,
      'no-useless-plusplus': noUselessPlusplus,
      'no-export-const-enum': no_export_const_enum,
      'no-for-in-iterable': noForInIterable,
      'only-await-thenable': onlyAwaitThenable,
      'no-undefined-optional-parameters': noUndefinedOptionalParameters,
      'no-try-promise': noTryPromise,
      'no-unthrown-error': noUnthrownError,
      'no-useless-string-operation': noUselessStringOperation,
      'react-filename-extension': reactFilenameExtension,
      'jsx-shorthand-boolean': jsxShorthandBoolean,
      'jsx-shorthand-fragment': jsxShorthandFragment,
      'react-prefer-destructuring-assignment': reactPreferDestructuringAssignment,
      'no-array-from-length-spread': noArrayFromLengthSpread,
      'prefer-foxts-error-util': preferFoxtsErrorUtil,
      'prefer-foxts-array-utils': preferFoxtsArrayUtils,
      'avoid-string-starts-with-single-char': avoidStringStartsWithSingleChar,
      'react-no-use-state-object': reactNoUseStateObject,
      'no-object-create-non-null': noObjectCreateNonNull,
      'prefer-foxts-object-size': preferFoxtsObjectSize,
      'prefer-foxts-cast-array': preferFoxtsCastArray,
      'prefer-foxts-bitwise': preferFoxtsBitwise,
      'prefer-foxts-wait': preferFoxtsWait,

      'prefer-slice-over-split-index': preferSliceOverSplitIndex,
    }
  )
};

export default plugin;
export { plugin as eslint_plugin_sukka };

import { createRule, isParserWithTypeInformation, ensureParserWithTypeInformation } from '@/utils/create-eslint-rule';

export { createRule, isParserWithTypeInformation, ensureParserWithTypeInformation };
export type { RuleModule, ExportedRuleModule } from '@/utils/create-eslint-rule';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = plugin;
  Object.assign(module.exports, {
    default: plugin,
    createRule,
    isParserWithTypeInformation,
    ensureParserWithTypeInformation,
    eslint_plugin_sukka: plugin
  });
}
