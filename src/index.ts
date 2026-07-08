import type { Linter } from 'eslint';

// eslint-plugin-sukka
import ban_eslint_disable from './rules/ban-eslint-disable';
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
import noChainArrayHigherOrderFunctions from './rules/no-chain-array-higher-order-functions';

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
import jsxNoDuplicateProps from './rules/jsx-no-duplicate-props';
import jsxNoExplicitSpreadProps from './rules/jsx-no-explicit-spread-props';
import reactNoMixingControlledAndUncontrolledProps from './rules/react-no-mixing-controlled-and-uncontrolled-props';
import noLocationAssignRelativeDestination from './rules/no-location-assign-relative-destination';
import reactNoUnnecessaryUseCallback from './rules/react-no-unnecessary-use-callback';
import reactNoUnnecessaryUseMemo from './rules/react-no-unnecessary-use-memo';
import reactPreferDestructuringAssignment from './rules/react-prefer-destructuring-assignment';
import reactNoCircularEffect from './rules/react-no-circular-effect';
import reactPreferStateUpdaterFunction from './rules/react-prefer-state-updater-function';
import noArrayFromLengthSpread from './rules/no-array-from-length-spread';
import reactPreferFoxactUseClipboard from './rules/react-prefer-foxact-use-clipboard';
import reactPreferFoxactPersistent from './rules/react-prefer-foxact-persistent';
import reactNoUseEffectWatching from './rules/react-no-use-effect-watching';
import reactNoManualUseEffectRaceConditionPrevention from './rules/react-no-manual-use-effect-race-condition-prevention';
import reactPreferFoxactUseMediaQuery from './rules/react-prefer-foxact-use-media-query';
import preferFoxtsNoop from './rules/prefer-foxts-noop';
import preferNullthrow from './rules/prefer-nullthrow';
import reactPreferFoxactComposeContextProvider from './rules/react-prefer-foxact-compose-context-provider';
import reactNoRenderFunctionProp from './rules/react-no-render-function-prop';
import reactPreferPropsWithChildren from './rules/react-prefer-props-with-children';
import reactPreferFoxactUseAbortableEffect from './rules/react-prefer-foxact-use-abortable-effect';
import preferFoxtsErrorUtil from './rules/prefer-foxts-error-util';
import preferFoxtsArrayUtils from './rules/prefer-foxts-array-utils';
import avoidStringStartsWithSingleChar from './rules/avoid-string-starts-with-single-char';
import reactNoUseStateAsRef from './rules/react-no-use-state-as-ref';
import reactNoUseStateObject from './rules/react-no-use-state-object';
import reactNoPerformanceImpactingArrayFind from './rules/react-no-performance-impacting-array-find';
import noRegexInFunction from './rules/no-regex-in-function';
import noConstantArrayIncludes from './rules/no-constant-array-includes';
import preferExportDestructuring from './rules/prefer-export-destructuring';
import noObjectCreateNonNull from './rules/no-object-create-non-null';
import preferFoxtsObjectSize from './rules/prefer-foxts-object-size';

const plugin = {
  configs: {
    recommended: {
      name: 'eslint-plugin-sukka/recommended',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: {
        'sukka/ban-eslint-disable': ['error', 'allow-with-description'],

        'sukka/bool-param-default': 'error',
        'sukka/call-argument-line': 'error',
        'sukka/class-prototype': 'warn',
        'sukka/comma-or-logical-or-case': 'error',
        'sukka/no-all-duplicated-branches': 'error',
        'sukka/no-array-from-length-spread': 'error',
        'sukka/no-chain-array-higher-order-functions': 'error',
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
        'sukka/avoid-string-starts-with-single-char': 'error',
        'sukka/no-regex-in-function': 'warn',
        'sukka/no-constant-array-includes': 'warn',
        'sukka/react-no-use-state-object': 'warn',
        'sukka/prefer-export-destructuring': 'warn',
        'sukka/no-object-create-non-null': 'warn',
        'sukka/track-todo-fixme-comment': 'warn'
      } as Linter.RulesRecord
    },
    recommended_extra_with_typed_lint: {
      name: 'eslint-plugin-sukka/recommended_extra_with_typed_lint',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: {
        'sukka/no-for-in-iterable': 'error',
        'sukka/no-try-promise': 'error',
        'sukka/no-undefined-optional-parameters': 'warn',
        'sukka/no-useless-string-operation': 'warn',
        'sukka/only-await-thenable': 'off' // replaced by typescript-eslint await-thenable rule
      } as Linter.RulesRecord
    },
    recommended_react: {
      name: 'eslint-plugin-sukka/recommended_react',
      plugins: {
        get sukka() {
          return plugin;
        }
      },
      rules: {
        'sukka/react-filename-extension': ['error', { allow: 'as-needed' }],
        'sukka/jsx-shorthand-boolean': 'error',
        'sukka/jsx-shorthand-fragment': 'error',
        'sukka/jsx-no-duplicate-props': 'error',
        'sukka/jsx-no-explicit-spread-props': 'warn',
        'sukka/react-no-mixing-controlled-and-uncontrolled-props': 'error',
        'sukka/no-location-assign-relative-destination': 'error',
        'sukka/react-no-unnecessary-use-callback': 'error',
        'sukka/react-no-unnecessary-use-memo': 'error',
        'sukka/react-prefer-destructuring-assignment': 'warn',
        'sukka/react-no-circular-effect': 'error',
        'sukka/react-prefer-state-updater-function': 'error',
        'sukka/react-prefer-foxact-use-clipboard': 'error',
        'sukka/react-prefer-foxact-persistent': 'error',
        'sukka/react-no-use-effect-watching': 'error',
        'sukka/react-no-manual-use-effect-race-condition-prevention': 'error',
        'sukka/react-prefer-foxact-use-media-query': 'error',
        'sukka/react-prefer-foxact-compose-context-provider': 'error',
        'sukka/react-no-render-function-prop': 'error',
        'sukka/react-prefer-props-with-children': 'error',
        'sukka/react-prefer-foxact-use-abortable-effect': 'error',
        'sukka/react-no-use-state-as-ref': 'error',
        'sukka/react-no-performance-impacting-array-find': 'warn'
      } as Linter.RulesRecord
    }
  },
  rules: {
    'ban-eslint-disable': ban_eslint_disable,

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
    'no-chain-array-higher-order-functions': noChainArrayHigherOrderFunctions,
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
    'jsx-no-duplicate-props': jsxNoDuplicateProps,
    'jsx-no-explicit-spread-props': jsxNoExplicitSpreadProps,
    'react-no-mixing-controlled-and-uncontrolled-props': reactNoMixingControlledAndUncontrolledProps,
    'no-location-assign-relative-destination': noLocationAssignRelativeDestination,
    'react-no-unnecessary-use-callback': reactNoUnnecessaryUseCallback,
    'react-no-unnecessary-use-memo': reactNoUnnecessaryUseMemo,
    'react-prefer-destructuring-assignment': reactPreferDestructuringAssignment,
    'react-no-circular-effect': reactNoCircularEffect,
    'react-prefer-state-updater-function': reactPreferStateUpdaterFunction,
    'no-array-from-length-spread': noArrayFromLengthSpread,
    'react-prefer-foxact-use-clipboard': reactPreferFoxactUseClipboard,
    'react-prefer-foxact-persistent': reactPreferFoxactPersistent,
    'react-no-use-effect-watching': reactNoUseEffectWatching,
    'react-no-manual-use-effect-race-condition-prevention': reactNoManualUseEffectRaceConditionPrevention,
    'react-prefer-foxact-use-media-query': reactPreferFoxactUseMediaQuery,
    'react-prefer-foxact-compose-context-provider': reactPreferFoxactComposeContextProvider,
    'react-no-render-function-prop': reactNoRenderFunctionProp,
    'react-prefer-props-with-children': reactPreferPropsWithChildren,
    'react-prefer-foxact-use-abortable-effect': reactPreferFoxactUseAbortableEffect,
    'prefer-foxts-error-util': preferFoxtsErrorUtil,
    'prefer-foxts-array-utils': preferFoxtsArrayUtils,
    'avoid-string-starts-with-single-char': avoidStringStartsWithSingleChar,
    'react-no-use-state-as-ref': reactNoUseStateAsRef,
    'react-no-use-state-object': reactNoUseStateObject,
    'react-no-performance-impacting-array-find': reactNoPerformanceImpactingArrayFind,
    'no-regex-in-function': noRegexInFunction,
    'no-constant-array-includes': noConstantArrayIncludes,
    'prefer-export-destructuring': preferExportDestructuring,
    'no-object-create-non-null': noObjectCreateNonNull,
    'prefer-foxts-object-size': preferFoxtsObjectSize
  }
} as const;

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
