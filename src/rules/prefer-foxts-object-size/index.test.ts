import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Not the global Object
    dedent`
      const Object = { keys: () => [] };
      Object.keys(x).length === 0;
    `,
    // A different property than length
    'Object.keys(x).size === 0',
    // .length on something that isn't Object.keys
    'arr.length === 0',
    'foo().length === 0',
    // Multiple args — not the Object.keys form
    'Object.keys(x, y).length === 0',
    // Out of scope: only Object.keys is handled, not these variants
    'Reflect.ownKeys(x).length === 0',
    'Object.getOwnPropertyNames(x).length === 0',
    'Object.getOwnPropertySymbols(x).length === 0',
    // Regression: the native TC39 property-count proposal methods are already
    // the optimal, allocation-free form — never flag them.
    // https://github.com/tc39/proposal-object-property-count
    'Object.keysLength(x) === 0',
    'Object.keysLength(x)',
    'Object.keysLength(x) === 1',
    '!Object.keysLength(x)',
    'Object.getOwnPropertyNamesLength(x) === 0',
    'Object.getOwnPropertySymbolsLength(x) === 0',
    // Already using the utils
    dedent`
      import { isObjectEmpty } from 'foxts/is-object-empty';
      isObjectEmpty(x);
    `,
    dedent`
      import { keysLength } from 'foxts/property-count';
      keysLength(x);
    `
  ],
  invalid: [
    // === 0 → isObjectEmpty
    {
      code: 'Object.keys(x).length === 0',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // == 0
    {
      code: 'Object.keys(x).length == 0',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // !== 0 → not empty
    {
      code: 'Object.keys(x).length !== 0',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\n!isObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // < 1 → empty
    {
      code: 'Object.keys(x).length < 1',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // > 0 → not empty
    {
      code: 'Object.keys(x).length > 0',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\n!isObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // >= 1 → not empty
    {
      code: 'Object.keys(x).length >= 1',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\n!isObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // Literal on the left: 0 === ...
    {
      code: '0 === Object.keys(x).length',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // Literal on the left: 0 < ... → not empty
    {
      code: '0 < Object.keys(x).length',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\n!isObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // Negation → empty
    {
      code: '!Object.keys(x).length',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(x)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // Member-expression argument preserved
    {
      code: 'Object.keys(state.data).length === 0',
      output: 'import { isObjectEmpty } from \'foxts/is-object-empty\';\nisObjectEmpty(state.data)',
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },

    // Non-emptiness comparison → keysLength, only the .length subexpr replaced
    {
      code: 'Object.keys(x).length === 1',
      output: 'import { keysLength } from \'foxts/property-count\';\nkeysLength(x) === 1',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    {
      code: 'Object.keys(x).length > 5',
      output: 'import { keysLength } from \'foxts/property-count\';\nkeysLength(x) > 5',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    // Comparison against a non-literal → keysLength
    {
      code: 'Object.keys(x).length === y',
      output: 'import { keysLength } from \'foxts/property-count\';\nkeysLength(x) === y',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    {
      code: 'Object.keys(x).length === arr.length',
      output: 'import { keysLength } from \'foxts/property-count\';\nkeysLength(x) === arr.length',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    // Assignment / standalone usage → keysLength
    {
      code: 'const n = Object.keys(x).length;',
      output: 'import { keysLength } from \'foxts/property-count\';\nconst n = keysLength(x);',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    // Passed as argument → keysLength
    {
      code: 'doStuff(Object.keys(x).length);',
      output: 'import { keysLength } from \'foxts/property-count\';\ndoStuff(keysLength(x));',
      errors: [{ messageId: 'preferKeyLength' }]
    },

    // Reuse existing isObjectEmpty import — no duplicate added
    {
      code: dedent`
        import { isObjectEmpty } from 'foxts/is-object-empty';
        const empty = Object.keys(x).length === 0;
      `,
      output: dedent`
        import { isObjectEmpty } from 'foxts/is-object-empty';
        const empty = isObjectEmpty(x);
      `,
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // Reuse existing keysLength import — no duplicate added
    {
      code: dedent`
        import { keysLength } from 'foxts/property-count';
        const n = Object.keys(x).length + 1;
      `,
      output: dedent`
        import { keysLength } from 'foxts/property-count';
        const n = keysLength(x) + 1;
      `,
      errors: [{ messageId: 'preferKeyLength' }]
    },
    // Insert after existing (unrelated) import
    {
      code: dedent`
        import { foo } from 'bar';
        const empty = Object.keys(x).length === 0;
      `,
      output: dedent`
        import { foo } from 'bar';
        import { isObjectEmpty } from 'foxts/is-object-empty';

        const empty = isObjectEmpty(x);
      `,
      errors: [{ messageId: 'preferIsObjectEmpty' }]
    },
    // `foxts/property-count` exports `keysLength`
    {
      code: 'const single = Object.keys(obj).length === 1;',
      output: 'import { keysLength } from \'foxts/property-count\';\nconst single = keysLength(obj) === 1;',
      errors: [{ messageId: 'preferKeyLength' }]
    },
    {
      code: 'const count = Object.keys(obj).length;',
      output: 'import { keysLength } from \'foxts/property-count\';\nconst count = keysLength(obj);',
      errors: [{ messageId: 'preferKeyLength' }]
    }
  ]
}, {}, false);
