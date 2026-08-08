import { runTest } from '@test/run-test';
import type { TSESLint } from '@typescript-eslint/utils';
import module from '.';

/**
 * RuleTester resolves the rule names inside directive comments and fails on
 * unknown ones, so every rule the fixtures mention needs to exist. They never
 * report, the directives are only there to be rewritten.
 */
const noopRule: TSESLint.AnyRuleModule = {
  meta: { type: 'problem', schema: [], messages: {} },
  defaultOptions: [],
  create: () => ({})
};

function stubPlugin(...names: string[]) {
  return {
    rules: names.reduce<Record<string, TSESLint.AnyRuleModule>>((rules, name) => {
      rules[name] = noopRule;
      return rules;
    }, {})
  };
}

const stubbedPlugins = {
  sukka: stubPlugin(
    'no-small-switch',
    'prefer-nullthrow',
    'react-no-circular-effect',
    'no-regex-in-function',
    'react-no-use-state-as-ref',
    'react-ban-peak-via-ref'
  ),
  'vibe-proof': stubPlugin(
    'react-no-circular-effect',
    'prefer-hoisted-regex',
    'react-no-use-state-as-ref',
    'react-ban-peak-via-ref'
  ),
  '@typescript-eslint': stubPlugin('no-explicit-any')
};

runTest({
  module,
  valid: [
    // rules that did not move keep the `sukka/` prefix
    '// eslint-disable-next-line sukka/no-small-switch\nswitch (x) {}',
    '/* eslint-disable sukka/prefer-nullthrow */',
    // already migrated
    '// eslint-disable-next-line vibe-proof/react-no-circular-effect\nconst a = 1;',
    // a moved rule named in prose, not in a directive
    '// sukka/react-no-circular-effect is worth reading about',
    '// eslint-disable-next-line no-console -- sukka/react-no-circular-effect\nconsole.log(1);',
    // not a directive comment at all
    '// eslint-disable-me sukka/react-no-circular-effect',
    // other plugins are untouched
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nconst a: any = 1;'
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line sukka/react-no-circular-effect\nconst a = 1;',
      output: '// eslint-disable-next-line vibe-proof/react-no-circular-effect\nconst a = 1;',
      errors: [{ messageId: 'moved' }]
    },
    // renamed upstream
    {
      code: '// eslint-disable-next-line sukka/no-regex-in-function\nconst a = 1;',
      output: '// eslint-disable-next-line vibe-proof/prefer-hoisted-regex\nconst a = 1;',
      errors: [{ messageId: 'moved' }]
    },
    // the `-- description` is preserved verbatim
    {
      code: '// eslint-disable-next-line sukka/react-no-circular-effect -- legacy effect\nconst a = 1;',
      output: '// eslint-disable-next-line vibe-proof/react-no-circular-effect -- legacy effect\nconst a = 1;',
      errors: [{ messageId: 'moved' }]
    },
    // block comments and `eslint-enable`
    {
      code: '/* eslint-disable sukka/react-no-use-state-as-ref */',
      output: '/* eslint-disable vibe-proof/react-no-use-state-as-ref */',
      errors: [{ messageId: 'moved' }]
    },
    {
      code: '/* eslint-enable sukka/react-no-use-state-as-ref */',
      output: '/* eslint-enable vibe-proof/react-no-use-state-as-ref */',
      errors: [{ messageId: 'moved' }]
    },
    // a list mixing moved and unmoved rules only rewrites the moved ones
    {
      code: '/* eslint-disable sukka/react-no-circular-effect, sukka/no-small-switch */',
      output: '/* eslint-disable vibe-proof/react-no-circular-effect, sukka/no-small-switch */',
      errors: [{ messageId: 'moved' }]
    },
    // several moved rules in one directive
    {
      code: '/* eslint-disable sukka/react-no-circular-effect, sukka/no-regex-in-function */',
      output: '/* eslint-disable vibe-proof/react-no-circular-effect, vibe-proof/prefer-hoisted-regex */',
      errors: [{ messageId: 'moved' }, { messageId: 'moved' }]
    },
    // mixed with a core rule
    {
      code: '// eslint-disable-next-line sukka/react-ban-peak-via-ref, no-console -- mixed\nconsole.log(1);',
      output: '// eslint-disable-next-line vibe-proof/react-ban-peak-via-ref, no-console -- mixed\nconsole.log(1);',
      errors: [{ messageId: 'moved' }]
    },
    // moved rule in the middle of a list
    {
      code: '/* eslint-disable no-console, sukka/react-no-circular-effect, no-alert */',
      output: '/* eslint-disable no-console, vibe-proof/react-no-circular-effect, no-alert */',
      errors: [{ messageId: 'moved' }]
    },
    // `eslint-disable-line`
    {
      code: 'const a = 1; // eslint-disable-line sukka/react-no-circular-effect',
      output: 'const a = 1; // eslint-disable-line vibe-proof/react-no-circular-effect',
      errors: [{ messageId: 'moved' }]
    }
  ]
}, undefined, false, stubbedPlugins);
