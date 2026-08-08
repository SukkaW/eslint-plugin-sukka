import { createRule } from '@/utils/create-eslint-rule';

/**
 * Rules that used to live in eslint-plugin-sukka and now ship in
 * eslint-plugin-vibe-proof, mapping the old name to the vibe-proof one.
 *
 * A stale `eslint-disable sukka/<moved-rule>` is not a silent no-op: ESLint
 * fails with "Definition for rule ... was not found", so every one of these
 * has to be rewritten for the codebase to lint at all.
 */
const MOVED_RULES = new Map([
  ['ban-eslint-disable', 'ban-eslint-disable'],
  ['jsx-no-duplicate-props', 'jsx-no-duplicate-props'],
  ['jsx-no-explicit-spread-props', 'jsx-no-explicit-spread-props'],
  ['no-chain-array-higher-order-functions', 'no-chain-array-higher-order-functions'],
  ['no-constant-array-includes', 'no-constant-array-includes'],
  ['no-indexof-equality', 'no-indexof-equality'],
  ['no-location-assign-relative-destination', 'no-location-assign-relative-destination'],
  // renamed by vibe-proof
  ['no-regex-in-function', 'prefer-hoisted-regex'],
  ['prefer-export-destructuring', 'prefer-export-destructuring'],
  ['react-ban-peak-via-ref', 'react-ban-peak-via-ref'],
  ['react-detect-potential-race-condition', 'react-detect-potential-race-condition'],
  ['react-no-circular-effect', 'react-no-circular-effect'],
  ['react-no-manual-use-effect-race-condition-prevention', 'react-no-manual-use-effect-race-condition-prevention'],
  ['react-no-mixing-controlled-and-uncontrolled-props', 'react-no-mixing-controlled-and-uncontrolled-props'],
  ['react-no-performance-impacting-array-find', 'react-no-performance-impacting-array-find'],
  ['react-no-render-function-prop', 'react-no-render-function-prop'],
  ['react-no-unnecessary-use-callback', 'react-no-unnecessary-use-callback'],
  ['react-no-unnecessary-use-memo', 'react-no-unnecessary-use-memo'],
  ['react-no-use-effect-watching', 'react-no-use-effect-watching'],
  ['react-no-use-state-as-ref', 'react-no-use-state-as-ref'],
  ['react-prefer-foxact-compose-context-provider', 'react-prefer-foxact-compose-context-provider'],
  ['react-prefer-foxact-persistent', 'react-prefer-foxact-persistent'],
  ['react-prefer-foxact-use-abortable-effect', 'react-prefer-foxact-use-abortable-effect'],
  ['react-prefer-foxact-use-clipboard', 'react-prefer-foxact-use-clipboard'],
  ['react-prefer-foxact-use-media-query', 'react-prefer-foxact-use-media-query'],
  ['react-prefer-props-with-children', 'react-prefer-props-with-children'],
  ['react-prefer-state-updater-function', 'react-prefer-state-updater-function']
]);

/**
 * Matches the directive keyword and the whitespace after it, so the rule list
 * is whatever follows. Anchored and free of ambiguous quantifiers, the trailing
 * `\s` is a single character to keep it that way.
 */
const rDirective = /^\s*eslint-(?:disable|enable|disable-next-line|disable-line)\s/;

/** A single `sukka/<rule>` entry within the comma-separated rule list. */
const rSukkaRule = /(^|,)(\s*)sukka\/([\w$-]+)(?=\s*(?:,|$))/g;

export default createRule({
  name: 'migrate-vibe-proof-eslint-disable',
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Rewrite `eslint-disable` directives referencing rules that moved to eslint-plugin-vibe-proof.'
    },
    schema: [],
    messages: {
      moved: '`sukka/{{from}}` moved to eslint-plugin-vibe-proof. Use `vibe-proof/{{to}}` instead.'
    }
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      'Program:exit': () => {
        for (const comment of sourceCode.getAllComments()) {
          const matched = rDirective.exec(comment.value);
          if (!matched) continue;

          // Everything after the directive keyword, minus the `-- description`
          // justification: a moved rule may be named in that prose, and
          // rewriting it there would corrupt the explanation.
          const afterDirective = comment.value.slice(matched[0].length);
          const descriptionAt = afterDirective.indexOf('--');
          const ruleList = descriptionAt < 0
            ? afterDirective
            : afterDirective.slice(0, descriptionAt);

          // Offset of the rule list inside the source, past the comment opener.
          const listStart = comment.range[0] + 2 + matched[0].length;

          for (const rule of ruleList.matchAll(rSukkaRule)) {
            const to = MOVED_RULES.get(rule[3]);
            if (to == null) continue;

            // `rule[1]` is the leading comma, which stays put.
            const start = listStart + rule.index + rule[1].length + rule[2].length;
            const range: [number, number] = [start, start + 'sukka/'.length + rule[3].length];

            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(range[0]),
                end: sourceCode.getLocFromIndex(range[1])
              },
              messageId: 'moved',
              data: { from: rule[3], to },
              fix: (fixer) => fixer.replaceTextRange(range, `vibe-proof/${to}`)
            });
          }
        }
      }
    };
  }
});
